import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  X, 
  Scan, 
  CheckCircle2, 
  AlertTriangle, 
  History, 
  FileText, 
  ArrowRight,
  Edit2,
  Trash2,
  Calendar,
  User,
  Activity,
  Dumbbell,
  Copy,
  Plus
} from 'lucide-react';
import { Client, Machine, Trainer, WorkoutSession, ExerciseLog } from '../types';
import { processLegacyChart } from '../services/geminiService';
import { db } from '../firebase';
import { collection, writeBatch, doc, serverTimestamp, getDocs, query, where, increment } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn, parseSessionDate } from '../lib/utils';

interface ImporterProps {
  clients: Client[];
  machines: Machine[];
  trainers: Trainer[];
  initialClientId?: string;
  onComplete?: () => void;
}

interface ValidationLog {
  id: string;
  name: string;
  rawName?: string;
  settings?: string;
  weight: number;
  reps: any;
  isStaticHold: boolean;
  timeUnderLoad?: number | null;
  machineId?: string;
  isAnomalous?: boolean;
  anomalyReason?: string;
}

interface ValidationSession {
  id: string;
  sessionNumber: number;
  date: string;
  trainer: string;
  trainerId?: string;
  machines: ValidationLog[];
}

const legacyMachineMap: Record<string, string> = {
  "cx": "4 Way Neck",
  "hip add": "Hip Adduction",
  "hip abd": "Hip Abduction",
  "leg curl": "Leg Curl",
  "leg ext": "Leg Extension",
  "leg ext.": "Leg Extension",
  "leg press": "Leg Press",
  "pull down": "Pull Down",
  "chest press": "Chest Press",
  "comp row": "Compound Row",
  "comp. row": "Compound Row",
  "overhead": "Overhead Press",
  "pull over": "Seated Pull Over",
  "seated dip": "Seated Dip",
  "tricep ext": "Tricep Extension",
  "tricep ext.": "Tricep Extension",
  "bicep": "Biceps",
  "chest fly": "Chest/Pec Fly",
  "lateral raise": "Lateral Raise",
  "lumbar": "Lumbar Extension",
  "torso rotation": "Torso Rotation",
  "abs": "Seated Abdominals"
};

const normalizeMachineName = (rawName: string): string => {
  const clean = rawName.toLowerCase().trim();
  if (legacyMachineMap[clean]) {
    return legacyMachineMap[clean];
  }
  // Fallback: capitalize properly
  return rawName.charAt(0).toUpperCase() + rawName.slice(1);
};

export function LegacyChartImporter({ clients, machines, trainers, initialClientId, onComplete }: ImporterProps) {
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClientId || '');
  const [expectedSessions, setExpectedSessions] = useState<number>(10);
  const [files, setFiles] = useState<{ name: string; base64: string; mimeType: string; previewUrl: string }[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  const [validationSessions, setValidationSessions] = useState<ValidationSession[]>([]);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement> | { target: { files: FileList | null } }) => {
    const files = e.target.files;
    if (files) {
      (Array.from(files) as File[]).forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64Content = (event.target?.result as string).split(',')[1];
          setFiles(prev => [...prev, {
            name: file.name,
            base64: base64Content,
            mimeType: file.type,
            previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
          }]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearFiles = () => {
    setFiles([]);
    setValidationSessions([]);
  };

  const runOCR = async () => {
    if (!selectedClientId || files.length === 0 || !expectedSessions) return;

    setIsScanning(true);
    setScanProgress('Waking Vision Engine...');
    setValidationSessions([]);

    try {
      const imageFiles = files.map(f => ({ base64: f.base64, mimeType: f.mimeType }));
      setScanProgress(`Analyzing ${files.length} images simultaneously...`);
      const ocrResult = await processLegacyChart(imageFiles, expectedSessions);

      // Reconstructed Merge Logic
      const sessionsMap: Record<number, ValidationSession> = {};

      // 1. Map over headers first to establish sessions
      ocrResult.sessionHeaders.forEach(header => {
        const sNum = header.sessionNumber;
        
        // Find matching trainer initials in our database
        const trainerMatch = trainers.find(t => 
          t.initials.toLowerCase() === (header.trainer || '').toLowerCase()
        );

        sessionsMap[sNum] = {
          id: `v-sess-${sNum}-${Date.now()}-${Math.random()}`,
          sessionNumber: sNum,
          date: header.date || '',
          trainer: header.trainer || 'Legacy',
          trainerId: trainerMatch?.id || 'legacy-trainer',
          machines: []
        };
      });

      // 2. Stitch performances to headers
      ocrResult.performances.forEach(perf => {
        const sNum = perf.sessionNumber;
        
        // Ensure session exists even if header was missed
        if (!sessionsMap[sNum]) {
          sessionsMap[sNum] = {
            id: `v-sess-${sNum}-${Date.now()}-${Math.random()}`,
            sessionNumber: sNum,
            date: '',
            trainer: 'Legacy',
            trainerId: 'legacy-trainer',
            machines: []
          };
        }

        // Deterministic Static Hold Logic
        const isSH = perf.isStaticHold || 
                     Number(perf.reps) > 20 || 
                     String(perf.reps || '').toUpperCase().includes('SH');
        
        const rawMachineName = perf.machineName;
        const normalizedName = normalizeMachineName(rawMachineName);

        const machineMatch = machines.find(mach => 
          mach.name.toLowerCase() === normalizedName.toLowerCase() ||
          normalizedName.toLowerCase().includes(mach.name.toLowerCase())
        );

        // Map into validation format
        sessionsMap[sNum].machines.push({
          id: `v-log-${sNum}-${perf.machineName}-${Date.now()}-${Math.random()}`,
          name: normalizedName,
          rawName: rawMachineName,
          settings: perf.settings,
          weight: Number(perf.weight) || 0,
          reps: isSH ? 0 : Number(perf.reps) || 0,
          isStaticHold: isSH,
          timeUnderLoad: isSH ? (Number(perf.reps) || 90) : 0,
          machineId: machineMatch?.id,
          isAnomalous: !machineMatch || (Number(perf.weight) === 0 && !isSH),
          anomalyReason: !machineMatch ? `Unknown Machine: ${normalizedName}` : 'Missing Data'
        });
      });

      // 3. Convert to sorted array
      let mappedSessions = Object.values(sessionsMap).sort((a, b) => a.sessionNumber - b.sessionNumber);
      setValidationSessions(mappedSessions);
      setScanProgress('OCR Pipeline Complete');
    } catch (err) {
      console.error(err);
      setScanProgress('Engine Failure: Check Logs');
    } finally {
      setIsScanning(false);
    }
  };

  const updateLogData = (sessionId: string, logId: string, field: string, value: any) => {
    setValidationSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        machines: s.machines.map(l => {
          if (l.id !== logId) return l;
          return { ...l, [field]: value };
        })
      };
    }));
  };

  const duplicateLog = (sessionId: string, logId: string) => {
    setValidationSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      const logToDup = s.machines.find(l => l.id === logId);
      if (!logToDup) return s;
      
      const newLog = { 
        ...logToDup, 
        id: `v-log-dup-${Date.now()}-${Math.random()}`,
        name: logToDup.name.includes('(Set 2)') ? logToDup.name : `${logToDup.name} (Set 2)`
      };
      
      return {
        ...s,
        machines: [...s.machines, newLog]
      };
    }));
  };

  const finalizeImport = async () => {
    if (!selectedClientId || isFinalizing) return;
    setIsFinalizing(true);

    try {
      const batch = writeBatch(db);
      
      // 1. Process Sessions & Logs
      for (const vSess of validationSessions) {
        const sessionRef = doc(collection(db, 'sessions'));
        
        // Standardize Date (MM/DD/YYYY required globally for consistency)
        let formattedDate = vSess.date;
        if (vSess.date) {
          const timestamp = parseSessionDate(vSess.date);
          if (timestamp > 0) {
            const dateObj = new Date(timestamp);
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dateObj.getDate()).padStart(2, '0');
            const yyyy = dateObj.getFullYear();
            formattedDate = `${yyyy}-${mm}-${dd}`;
          }
        }

        const fallbackDate = () => {
          const now = new Date();
          return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        };

        const sessionData: WorkoutSession = {
          clientId: selectedClientId,
          sessionType: 'Standard',
          sessionNumber: vSess.sessionNumber,
          date: formattedDate || fallbackDate(),
          trainerInitials: vSess.trainer,
          trainerId: vSess.trainerId || 'legacy-trainer',
          status: 'Completed',
          createdAt: serverTimestamp(),
          endTime: serverTimestamp()
        };
        batch.set(sessionRef, sessionData);

        for (const vLog of vSess.machines) {
          if (!vLog.machineId) continue;
          const logRef = doc(collection(db, 'exerciseLogs'));
          const logData: ExerciseLog = {
            sessionId: sessionRef.id,
            clientId: selectedClientId,
            machineId: vLog.machineId,
            weight: String(vLog.weight),
            reps: vLog.isStaticHold ? '' : String(vLog.reps || ''),
            seconds: vLog.isStaticHold ? String(vLog.timeUnderLoad || '') : '',
            isTSC: vLog.isStaticHold,
            isStaticHold: vLog.isStaticHold,
            machineSettings: vLog.settings ? { "Seat": vLog.settings } : {},
            repQuality: 2, // Standardized: 2 = Yellow/Completed for legacy imports
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
          batch.set(logRef, logData);
        }
      }

      // 2. Update client session count and profile
      const maxSessionNum = validationSessions.length > 0 
        ? Math.max(...validationSessions.map(s => s.sessionNumber)) 
        : 0;
      
      const clientRef = doc(db, 'clients', selectedClientId);
      batch.update(clientRef, {
        completedSessions: increment(validationSessions.length),
        sessionCount: maxSessionNum, // Set to highest imported session number
        updatedAt: serverTimestamp()
      });

      await batch.commit();
      if (onComplete) onComplete();
    } catch (err) {
      console.error(err);
      alert('Finalization failed. Check Firestore quotas.');
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 p-4 sm:p-6 bg-slate-950 min-h-screen text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase italic text-white flex items-center gap-2">
            <Scan className="w-8 h-8 text-[#F06C22]" />
            OCR Legacy Pipeline
          </h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
            Multimodal Chart Recognition Engine v3.1
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger className="w-[240px] bg-slate-900 border-slate-800 text-white font-bold h-11">
              <SelectValue placeholder="Select Target Client..." />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-white">
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id!} className="hover:bg-slate-800 focus:bg-slate-800">
                  {c.firstName} {c.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {validationSessions.length > 0 && (
            <Button 
              onClick={finalizeImport}
              disabled={isFinalizing || validationSessions.some(s => !s.date)}
              className="bg-[#F06C22] hover:bg-[#F06C22]/90 text-white font-black px-6 h-11 tracking-widest uppercase text-xs disabled:opacity-50"
            >
              {isFinalizing ? 'Committing...' : '[ Finalize & Import Data ]'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input/Upload */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="bg-[#0A2E46]/30 border-slate-800 overflow-hidden">
            <CardHeader className="bg-slate-900/50 py-3 border-b border-slate-800">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">
                Data Source Upload
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="mb-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Expected Sessions to Extract</label>
                  <div className="flex items-center gap-4 bg-slate-900 border border-slate-700 rounded-xl p-3">
                    <Input 
                      type="number"
                      value={expectedSessions}
                      onChange={(e) => setExpectedSessions(parseInt(e.target.value) || 0)}
                      className="w-24 bg-slate-800 border-slate-700 text-center font-black text-lg focus:ring-[#F06C22] h-10"
                    />
                    <p className="text-[10px] text-slate-400 font-medium leading-tight">
                      Bounding cross-grid search space to maximize extraction speed.
                    </p>
                  </div>
                </div>
              </div>

              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  handleFileSelect({ target: { files: e.dataTransfer.files } } as any);
                }}
                className="w-full h-40 border-2 border-dashed border-slate-700 bg-slate-900/50 rounded-xl flex flex-col items-center justify-center p-6 cursor-pointer hover:border-[#F06C22]/50 hover:bg-slate-800/30 transition-all group relative"
              >
                <input 
                  type="file" 
                  multiple 
                  accept="image/*,application/pdf" 
                  ref={fileInputRef}
                  className="hidden" 
                  onChange={handleFileSelect}
                />
                <Upload className="w-10 h-10 text-slate-600 group-hover:text-[#F06C22] mb-3 transition-colors" />
                <p className="text-sm font-black text-slate-300 uppercase tracking-tighter text-center">Drop Multiple Chart Images</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase mt-2 text-center">Batch Processing (Up to 8 Images)</p>
              </div>

              {files.length > 0 && (
                  <div className="mt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Queue ({files.length})</p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={clearFiles}
                        className="text-[9px] font-black text-red-500 hover:text-red-400 hover:bg-red-500/10 h-6 uppercase px-2"
                      >
                        Clear All
                      </Button>
                    </div>
                    
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-800">
                      {files.map((file, idx) => (
                        <div key={idx} className="relative group bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shrink-0 w-24 h-24">
                          {file.previewUrl ? (
                            <img src={file.previewUrl} className="w-full h-full object-cover opacity-60" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-800">
                              <FileText className="w-6 h-6 text-slate-600" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button onClick={() => removeFile(idx)} className="p-1.5 bg-red-600/20 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all">
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <div className="absolute bottom-1 left-1 right-1 px-1 py-0.5 bg-black/50 backdrop-blur-sm rounded text-[7px] font-black truncate text-white">
                            {file.name}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <Button 
                      variant="outline"
                      className={cn(
                        "w-full border-slate-700 text-white font-black h-12 mt-4 tracking-widest uppercase text-xs transition-all",
                        expectedSessions > 0 && selectedClientId ? "bg-[#0A2E46] hover:bg-[#F06C22] hover:text-white" : "bg-slate-900/50 opacity-50 cursor-not-allowed"
                      )}
                      onClick={runOCR}
                      disabled={isScanning || !selectedClientId || expectedSessions <= 0}
                    >
                      <Scan className={cn("w-4 h-4 mr-2", isScanning && "animate-spin")} />
                      {isScanning ? 'SCANNING GRID...' : 'START CLINICAL EXTRACTION'}
                    </Button>
                  </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Validation HUD */}
        <div className="lg:col-span-8 flex flex-col">
          <Card className="bg-[#0A2E46] border-slate-800 flex-1 flex flex-col min-h-[600px] shadow-2xl">
            <CardHeader className="py-4 border-b border-slate-800 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-widest text-[#F06C22]">
                  Validation HUD
                </CardTitle>
                <CardDescription className="text-[10px] font-bold text-slate-400">
                  Verify extracted patterns before database commit
                </CardDescription>
              </div>
              {validationSessions.length > 0 && (
                <div className="flex gap-4 items-center">
                  <div className="text-right px-4 border-r border-slate-800">
                    <p className="text-[10px] font-black text-white uppercase">Expected Sessions: {expectedSessions}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Trainer Bounding Box</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-[#F06C22] uppercase">Extracted Found: {validationSessions.length}</p>
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter">Verified Alignment</p>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0 overflow-hidden flex-1 relative">
              <AnimatePresence mode="wait">
                {validationSessions.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full flex flex-col items-center justify-center p-12 text-center"
                  >
                    {isScanning ? (
                      <div className="flex flex-col items-center space-y-6">
                        <div className="relative">
                          <div className="w-24 h-24 rounded-full border-4 border-[#0A2E46] border-t-[#F06C22] animate-spin"></div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Scan className="w-10 h-10 text-[#F06C22]" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-lg font-black text-white uppercase tracking-widest animate-pulse">Analyzing Grid Intersections</h3>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest max-w-xs mx-auto">
                            Performing row-by-row clinical extraction. This may take 30-60 seconds depending on data density.
                          </p>
                        </div>
                        <Badge variant="outline" className="bg-[#0A2E46] text-[#F06C22] border-[#F06C22]/30 px-4 py-1">
                          {scanProgress}
                        </Badge>
                      </div>
                    ) : (
                      <>
                        <div className="w-20 h-20 bg-slate-900/50 rounded-full flex items-center justify-center mb-6">
                          <History className="w-10 h-10 text-slate-700" />
                        </div>
                        <h3 className="text-lg font-black text-slate-500 uppercase tracking-widest mb-2 italic">Idle - Waiting for Feed</h3>
                        <p className="text-xs text-slate-600 max-w-xs leading-relaxed">
                          Enter target session count and upload high-resolution scans to initiate the multimodal clinical extraction pipeline.
                        </p>
                      </>
                    )}
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-4 space-y-6 overflow-y-auto max-h-[60vh] scrollbar-thin scrollbar-thumb-slate-700"
                  >
                    {/* Macro Summary Panel */}
                    <div className="bg-[#0A2E46] border border-[#F06C22]/30 rounded-xl p-4 mb-4 flex items-center justify-between shadow-[0_0_20px_rgba(240,108,34,0.05)]">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-[#F06C22]/10 rounded-full text-[#F06C22]">
                          <CheckCircle2 size={24} />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-white uppercase tracking-widest">Clinical History Consolidated</h3>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                            Successfully extracted {
                              Array.from(new Set(validationSessions.flatMap(s => s.machines.map(m => m.name)))).length
                            } unique machines spanning {validationSessions.length} total sessions.
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-[#F06C22] text-[#F06C22] font-black uppercase text-[8px] px-3">
                        CONTINUITY VERIFIED
                      </Badge>
                    </div>

                    {/* Extraction Frequency Panel */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 mb-4">
                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Machine Extraction Frequency</h3>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(
                          validationSessions.reduce((acc, sess) => {
                            sess.machines.forEach(m => {
                              acc[m.name] = (acc[m.name] || 0) + 1;
                            });
                            return acc;
                          }, {} as Record<string, number>)
                        ).map(([name, count]) => (
                          <Badge key={name} variant="secondary" className="bg-slate-800 text-slate-300 text-[9px] font-bold px-2 py-1 rounded-md border border-slate-700">
                            {name}: {count} logs
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {validationSessions.map((session) => (
                      <div key={session.id} className="space-y-3">
                        <div className={cn(
                          "flex items-center gap-3 bg-slate-900/80 p-3 rounded-lg border transition-all",
                          (!session.date || !session.trainer) ? "border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.1)]" : "border-slate-800"
                        )}>
                          <Badge className={cn(
                            "font-black border-transparent",
                            (!session.date || !session.trainer) ? "bg-amber-600 text-white" : "bg-slate-800 text-white border-slate-700"
                          )}>
                            S#{session.sessionNumber}
                          </Badge>
                          <div className="flex-1 flex items-center gap-4">
                            <div className="flex items-center gap-1.5 px-4 border-r border-slate-800">
                               <p className="text-[10px] font-black text-[#F06C22] uppercase">Machines Logged: {session.machines.length}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Calendar className={cn("w-3 h-3 transition-colors", !session.date ? "text-amber-500 animate-pulse" : "text-slate-500")} />
                              <input 
                                type="text"
                                placeholder="MM/DD/YYYY"
                                value={session.date}
                                onChange={e => setValidationSessions(prev => prev.map(s => s.id === session.id ? { ...s, date: e.target.value } : s))}
                                className={cn(
                                  "bg-transparent border transition-all text-[10px] font-black uppercase tracking-widest focus:ring-0 px-2 py-1 rounded w-24",
                                  !session.date ? "border-amber-500 text-amber-500 bg-amber-500/10" : "border-transparent text-[#F06C22]"
                                )}
                              />
                            </div>
                            <div className="flex items-center gap-1.5 border-l border-slate-800 pl-4">
                              <User className={cn("w-3 h-3 transition-colors", !session.trainer ? "text-amber-500 animate-pulse" : "text-slate-500")} />
                              <span className="text-[10px] font-black text-slate-300 uppercase">Trainer:</span>
                              <input 
                                value={session.trainer}
                                placeholder="INI"
                                onChange={e => setValidationSessions(prev => prev.map(s => s.id === session.id ? { ...s, trainer: e.target.value } : s))}
                                className={cn(
                                  "bg-transparent border transition-all text-[10px] font-black uppercase focus:ring-0 w-16 px-2 py-1 rounded",
                                  !session.trainer ? "border-amber-500 text-amber-500 bg-amber-500/10" : "border-transparent text-white"
                                )}
                              />
                            </div>
                          </div>
                          {(!session.date || !session.trainer) && (
                            <Badge variant="outline" className="text-[8px] font-black text-amber-500 border-amber-500/30 animate-pulse">
                              MISSING HEADER DATA
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-1.5">
                          {session.machines.map((log) => (
                            <div 
                              key={log.id} 
                              className={cn(
                                "p-2 rounded border shadow-lg relative group transition-all",
                                log.isStaticHold 
                                  ? "border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.1)]" 
                                  : log.isAnomalous 
                                    ? "border-amber-500 bg-amber-500/10" 
                                    : "border-[#F06C22]/50 bg-[#F06C22]/5 hover:border-[#F06C22]" // Quality 3 styling
                              )}
                            >
                              <div className="flex flex-col mb-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 mr-1">
                                    <input 
                                      value={log.name} 
                                      onChange={e => updateLogData(session.id, log.id, 'name', e.target.value)}
                                      className="bg-transparent border-none text-[9px] font-black text-white uppercase tracking-tighter w-full focus:ring-0 p-0 truncate"
                                    />
                                    {log.rawName && log.rawName.toLowerCase() !== log.name.toLowerCase() && (
                                      <p className="text-[7px] text-slate-500 font-bold uppercase truncate -mt-0.5">
                                        Raw: {log.rawName}
                                      </p>
                                    )}
                                  </div>
                                  {log.isAnomalous && (
                                    <div className="group/tip relative cursor-help">
                                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                                      <div className="absolute bottom-full right-0 mb-2 w-40 p-2 bg-amber-600 text-white text-[7px] font-bold rounded shadow-xl opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none z-10">
                                        {log.anomalyReason}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <Badge variant="outline" className="text-[6px] font-bold py-0 h-3 border-slate-700 text-slate-500 bg-slate-800/50">
                                    {log.settings || 'NO SETTINGS'}
                                  </Badge>
                                  {log.isStaticHold && (
                                    <Badge className="text-[6px] font-black py-0 h-3 bg-blue-500 text-white uppercase">
                                      TUL/SH
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-1.5 mb-2">
                                <div>
                                  <label className="text-[6px] font-black text-slate-500 uppercase block mb-0.5">LBS</label>
                                  <input 
                                    type="number"
                                    value={log.weight}
                                    onChange={e => updateLogData(session.id, log.id, 'weight', parseInt(e.target.value) || 0)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-[10px] font-black text-white focus:border-[#F06C22] focus:ring-0 h-7"
                                  />
                                </div>
                                <div>
                                  <label className={cn(
                                    "text-[6px] font-black uppercase block mb-0.5",
                                    log.isStaticHold ? "text-blue-400" : "text-slate-500"
                                  )}>
                                    {log.isStaticHold ? 'SEC' : 'REPS'}
                                  </label>
                                  <input 
                                    type="number"
                                    value={log.isStaticHold ? (log.timeUnderLoad ?? 0) : (log.reps ?? 0)}
                                    onChange={e => updateLogData(session.id, log.id, log.isStaticHold ? 'timeUnderLoad' : 'reps', parseInt(e.target.value) || 0)}
                                    className={cn(
                                      "w-full bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-[10px] font-black focus:ring-0 h-7",
                                      log.isStaticHold ? "text-blue-400 border-blue-500/30" : "text-white focus:border-[#F06C22]"
                                    )}
                                  />
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="text-[6px] font-black text-slate-600 uppercase tracking-widest truncate">
                                  {log.isStaticHold ? 'STAT_MODE' : 'DYN_MODE'}
                                </div>
                                <div className="flex gap-1">
                                  <button 
                                    onClick={() => duplicateLog(session.id, log.id)}
                                    className="p-1 bg-slate-800 text-slate-400 hover:text-[#F06C22] hover:bg-[#F06C22]/10 rounded transition-colors"
                                  >
                                    <Copy size={8} />
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setValidationSessions(prev => prev.map(s => {
                                        if (s.id !== session.id) return s;
                                        return {
                                          ...s,
                                          machines: s.machines.filter(l => l.id !== log.id)
                                        };
                                      }))
                                    }}
                                    className="p-1 bg-slate-800 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                  >
                                    <Trash2 size={8} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
