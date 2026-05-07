import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Activity, TrendingUp, Save, Clock, Dumbbell, AlertCircle, History, Wand2, LineChart as LineChartIcon, Zap, MessageSquare } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, setDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Machine, Client, ExerciseLog, ClientMachineSetting, MachineNote } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { calculateExerciseVolume } from '../lib/utils';
import { MachineSetupWizard } from './MachineSetupWizard';
import { MachineExecutionCoach } from './MachineExecutionCoach';
import { MachineClinicalStrategist } from './MachineClinicalStrategist';

interface Props {
  client: Client;
  machine: Machine | null;
  onClose: () => void;
}

// Helper for concise time formatting
function formatTime(seconds: number) {
  if (!seconds) return '00:00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Shorthand mapper
function getSettingShorthand(settingName: string) {
  const map: Record<string, string> = {
    'gap': 'G',
    'seat': 'S',
    'back pad': 'B',
    'back height': 'BH',
    'back angle': 'BA',
    'weight': 'W',
    'pin': 'P',
    'setting': 'SET'
  };
  return map[settingName.toLowerCase()] || settingName.substring(0, 2).toUpperCase();
}

export function MachineInsightsModal({ client, machine, onClose }: Props) {
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [settingsDetail, setSettingsDetail] = useState<ClientMachineSetting | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isImportantNote, setIsImportantNote] = useState(false);
  const [activeTab, setActiveTab] = useState<'insights' | 'setup' | 'execution' | 'clinical'>('setup');

  useEffect(() => {
    if (!client.id || !machine?.id) {
      setLogs([]);
      setSettingsDetail(null);
      return;
    }

    // Clear previous data while loading new machine
    setLogs([]);
    setSettingsDetail(null);

    // Fetch logs specifically for THIS client AND THIS machine, limited to most recent 6, then ordered asc chronologically
    const qLogs = query(
      collection(db, 'exerciseLogs'),
      where('clientId', '==', client.id),
      where('machineId', '==', machine.id),
      orderBy('createdAt', 'desc'),
      limit(6)
    );
    
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      const fetchedLogs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExerciseLog));
      // Strictly enforce machineId isolation to prevent data bleeding
      const validLogs = fetchedLogs.filter(l => l.machineId === machine.id);
      validLogs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeA - timeB; // sort asc
      });
      setLogs(validLogs);
    });

    const settingsDocId = `${client.id}_${machine.id}`;
    const unsubSettings = onSnapshot(doc(db, 'clientMachineSettings', settingsDocId), (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as ClientMachineSetting;
        setSettingsDetail(data);
      } else {
        setSettingsDetail(null);
      }
    });

    return () => {
      unsubLogs();
      unsubSettings();
    };
  }, [client.id, machine?.id]);

  const handleSaveNote = async () => {
    if (!client.id || !machine?.id || !newNoteContent.trim()) return;
    setIsSavingNote(true);
    try {
      const settingsDocId = `${client.id}_${machine.id}`;
      const docRef = doc(db, 'clientMachineSettings', settingsDocId);
      const docSnap = await getDoc(docRef);
      
      const newNote: MachineNote = {
        id: crypto.randomUUID(),
        content: newNoteContent.trim(),
        authorName: 'Trainer Workspace', // Defaulting to this as we might not have the user's name right in this scope
        timestamp: new Date(),
        isImportant: isImportantNote
      };

      if (docSnap.exists()) {
        const existingData = docSnap.data() as ClientMachineSetting;
        const updatedNotes = [...(existingData.machineNotes || []), newNote];
        await updateDoc(docRef, { machineNotes: updatedNotes });
      } else {
        await setDoc(docRef, {
          clientId: client.id,
          machineId: machine.id,
          settings: {},
          updatedBy: 'Trainer',
          updatedAt: new Date(),
          machineNotes: [newNote]
        });
      }
      setNewNoteContent('');
      setIsImportantNote(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingNote(false);
    }
  };

  const chartData = logs
    .filter(l => l.repQuality !== undefined && l.repQuality !== null && (parseInt(l.reps || '0') > 0 || parseInt(l.seconds || '0') > 0))
    .slice(-10) // show up to last 10
    .map((l, i) => {
      return {
        name: `S${i+1}`,
        quality: l.repQuality // e.g., 1-5 or 0-100
      };
    });

  const totalTimeSeconds = logs.reduce((acc, l) => acc + (parseInt(l.seconds || '0') || 0), 0);
  const formattedTime = formatTime(totalTimeSeconds);
  
  const normalLogs = logs.filter(l => !l.isStaticHold);
  const staticHoldLogs = logs.filter(l => l.isStaticHold);
  
  const totalReps = normalLogs.reduce((acc, l) => acc + (parseInt(l.reps || '0') || 0), 0);
  
  // Volume calculated using correct generic calculation
  const totalVolume = logs.reduce((acc, l) => acc + calculateExerciseVolume(l), 0);

  // In MSF, trainers enter the duration in seconds into the 'seconds' field for static holds
  const totalStaticHoldTime = staticHoldLogs.reduce((acc, l) => acc + (parseInt(l.seconds || '0') || 0), 0);
  
  const sortedNotes = [...(settingsDetail?.machineNotes || [])].sort((a, b) => {
    const timeA = a.timestamp?.toMillis?.() || 0;
    const timeB = b.timestamp?.toMillis?.() || 0;
    return timeB - timeA; // sort desc
  });

  const sortedSettingsHistory = [...(settingsDetail?.settingsHistory || [])].sort((a, b) => {
    const timeA = a.updatedAt?.toMillis?.() || 0;
    const timeB = b.updatedAt?.toMillis?.() || 0;
    return timeB - timeA; // sort desc
  });

  return (
    <Dialog open={!!machine} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-7xl h-[90vh] bg-[#0A2E46] p-0 overflow-hidden border-none rounded-3xl flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)]" aria-describedby="dialog-description">
        <DialogTitle className="sr-only">Machine Insights</DialogTitle>
        <DialogDescription id="dialog-description" className="sr-only">Detailed insights for this machine mapping</DialogDescription>
        
        {machine && (
          <>
            {/* Fixed Header */}
            <div className="bg-[#0e171e] p-6 border-b border-white/10 shrink-0">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-[#115E8D]/30 border border-[#38BDF8]/30 rounded-2xl flex items-center justify-center shadow-[0_0_15px_rgba(56,189,248,0.2)]">
                    <Activity className="w-8 h-8 text-[#38BDF8]" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-white leading-none uppercase drop-shadow-md">{machine.name}</h2>
                    <p className="text-[11px] font-black text-[#68717A] tracking-[0.2em] uppercase mt-1">Clinical Reference Chart</p>
                  </div>
                </div>
              </div>

              {/* Tabs Drop-in */}
              <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5">
                <button
                  onClick={() => setActiveTab('execution')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
                    activeTab === 'execution' ? 'bg-[#115E8D] text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Dumbbell className="w-4 h-4" />
                  Overview & Mechanics
                </button>
                <button
                  onClick={() => setActiveTab('setup')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
                    activeTab === 'setup' ? 'bg-[#F06C22] text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Wand2 className="w-4 h-4" />
                  Setup & Alignment
                </button>
                <button
                  onClick={() => setActiveTab('clinical')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
                    activeTab === 'clinical' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <AlertCircle className="w-4 h-4" />
                  Clinical Safety & Contraindications
                </button>
                <button
                  onClick={() => setActiveTab('insights')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
                    activeTab === 'insights' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <LineChartIcon className="w-4 h-4" />
                  Analytics & Trends
                </button>
              </div>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
               {activeTab === 'setup' ? (
                 <MachineSetupWizard client={client} machine={machine} />
               ) : activeTab === 'execution' ? (
                 <MachineExecutionCoach machine={machine} />
               ) : activeTab === 'clinical' ? (
                 <MachineClinicalStrategist client={client} machine={machine} />
               ) : (
                 <>
                   {/* Top Stats */}
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <Card className="rounded-2xl border border-white/10 bg-[#0e171e] shadow-lg">
                    <CardContent className="p-4 flex flex-col justify-center items-center h-full">
                       <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1 text-center">Total Time</span>
                       <div className="flex items-baseline gap-1">
                         <span className="text-xl font-black text-[#38BDF8]">{formattedTime}</span>
                       </div>
                    </CardContent>
                 </Card>
                 
                 <Card className="rounded-2xl border border-white/10 bg-[#0e171e] shadow-lg">
                    <CardContent className="p-4 flex flex-col justify-center items-center h-full">
                       <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1 text-center">Total Reps</span>
                       <div className="flex items-baseline gap-1">
                         <span className="text-2xl font-black text-[#38BDF8]">{(!isNaN(totalReps) ? totalReps : 0).toLocaleString()}</span>
                       </div>
                    </CardContent>
                 </Card>
                 
                 <Card className="rounded-2xl border border-white/10 bg-[#0e171e] shadow-lg col-span-2 md:col-span-1">
                    <CardContent className="p-4 flex flex-col justify-center items-center h-full">
                       <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1 text-center">Total Volume</span>
                       <div className="flex items-baseline gap-1">
                         <span className="text-2xl font-black text-[#38BDF8]">{(!isNaN(totalVolume) ? totalVolume : 0).toLocaleString()}</span>
                         <span className="text-[10px] font-bold text-slate-500 uppercase ml-1">Lbs</span>
                       </div>
                    </CardContent>
                 </Card>

                 {totalStaticHoldTime > 0 ? (
                   <Card className="rounded-2xl border border-emerald-500/20 bg-[#0e171e] shadow-lg col-span-2 md:col-span-1">
                      <CardContent className="p-4 flex flex-col justify-center items-center h-full bg-emerald-950/30 rounded-2xl">
                         <span className="text-[9px] font-black uppercase text-emerald-500 tracking-widest mb-1 text-center">Static Hold</span>
                         <div className="flex items-baseline gap-1 text-emerald-400">
                           <span className="text-2xl font-black">{totalStaticHoldTime}</span>
                           <span className="text-[10px] font-bold uppercase ml-1">Secs</span>
                         </div>
                      </CardContent>
                   </Card>
                 ) : (
                    <div className="hidden md:block col-span-1" />
                 )}
               </div>

               {/* Recent Session History Grid */}
               <div className="flex flex-col space-y-2 overflow-y-auto max-h-[400px] custom-scrollbar pr-2">
                 {[...logs].reverse().map((log, idx) => {
                   const repsRaw = parseInt(log.reps || '0');
                   const secondsRaw = parseInt(log.seconds || '0');
                   const isSkipped = repsRaw === 0 && secondsRaw === 0;
                   const logDate = log.createdAt?.toMillis ? new Date(log.createdAt.toMillis()) : new Date();

                   let qualityColor = 'text-slate-400 bg-slate-900/50';
                   if (log.repQuality === 3) qualityColor = 'text-emerald-400 bg-emerald-950/30';
                   else if (log.repQuality === 2) qualityColor = 'text-amber-400 bg-amber-950/30';
                   else if (log.repQuality === 1) qualityColor = 'text-red-400 bg-red-950/30';

                   return (
                     <div key={log.id} className={`flex items-center justify-between bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 rounded-xl p-3 transition-colors ${isSkipped ? 'opacity-40 grayscale' : ''}`}>
                       {/* Column 1: Date Block */}
                       <div className="w-14 flex flex-col items-center justify-center leading-none border-r border-slate-700/50 pr-3">
                         <span className="text-[9px] uppercase font-bold text-slate-500">
                           {logDate.toLocaleDateString('en-US', { month: 'short' })}
                         </span>
                         <span className="text-lg font-black text-slate-300">
                           {logDate.toLocaleDateString('en-US', { day: 'numeric' })}
                         </span>
                       </div>

                       {/* Column 2: Performance Hero */}
                       <div className="flex-1 px-4 flex items-center gap-3">
                         {isSkipped ? (
                           <span className="text-xs font-mono text-slate-600 tracking-widest">[ SKIPPED / 0 REPS ]</span>
                         ) : (
                           <>
                             <div className="flex items-baseline">
                               <span className="text-xl font-bold text-white tracking-tight">{log.weight}</span>
                               <span className="text-[10px] text-slate-500 ml-1">LBS</span>
                             </div>
                             <div className={`px-2 py-0.5 rounded-md flex items-center justify-center min-w-[36px] ${qualityColor}`}>
                               <span className="font-extrabold text-[11px]">
                                 {log.repsLeft !== undefined && log.repsRight !== undefined ? (
                                    `${log.repsLeft}L|${log.repsRight}R`
                                 ) : (
                                   log.isStaticHold ? `${log.seconds}s` : log.reps
                                 )}
                               </span>
                             </div>
                           </>
                         )}
                       </div>

                       {/* Column 3: Clinical Setup */}
                       <div className="flex shrink-0 items-center gap-1.5 flex-wrap justify-end max-w-[120px]">
                         {settingsDetail?.settings && Object.entries(settingsDetail.settings).map(([key, val]) => (
                           val && (
                             <Badge key={key} variant="outline" className="bg-slate-900 border-slate-700 text-slate-400 text-[10px] px-1.5 py-0 leading-tight">
                               {key.charAt(0).toUpperCase()}:{val}
                             </Badge>
                           )
                         ))}
                       </div>

                       {/* Column 4: Trainer Notes Indicator */}
                       {log.notes && (
                         <div className="ml-3 border-l border-slate-700/50 pl-3 flex items-center">
                           <MessageSquare className="w-4 h-4 text-slate-500" />
                         </div>
                       )}
                     </div>
                   );
                 })}
               </div>

               {/* Quality Trend Chart (Recharts) */}
               <Card className="rounded-2xl border border-white/10 bg-[#0e171e] shadow-lg">
                 <CardContent className="p-4">
                   <div className="flex justify-between items-center mb-4">
                     <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Repetition Quality Trend</span>
                   </div>
                   <div className="h-48 w-full">
                     {chartData.length > 0 ? (
                       <ResponsiveContainer width="100%" height="100%">
                         <LineChart data={chartData}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                           <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                           <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                           <Tooltip 
                             contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#0e171e', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.5)' }}
                             labelStyle={{ fontWeight: 'bold', color: '#94a3b8' }}
                           />
                           <Line 
                             type="monotone" 
                             dataKey="quality" 
                             stroke="#10b981" 
                             strokeWidth={3}
                             dot={{ r: 4, strokeWidth: 2, fill: '#0e171e', stroke: '#10b981' }}
                             activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }}
                           />
                         </LineChart>
                       </ResponsiveContainer>
                     ) : (
                       <div className="h-full flex items-center justify-center text-xs font-bold text-slate-600 uppercase tracking-widest">
                         No Quality Data Available
                       </div>
                     )}
                   </div>
                 </CardContent>
               </Card>

               {/* Settings History */}
               <Card className="rounded-2xl border border-white/10 bg-[#0e171e] shadow-lg">
                 <CardContent className="p-4">
                   <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-4">Settings & Config</span>
                   
                   <div className="bg-black/30 p-4 rounded-xl border border-white/5 mb-4">
                     <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-3 block border-b border-white/10 pb-2">Current Setup</span>
                     <div className="flex flex-wrap gap-2">
                       {settingsDetail?.settings && Object.keys(settingsDetail.settings).length > 0 ? (
                         Object.entries(settingsDetail.settings).map(([k,v]) => (
                           <Badge key={k} variant="secondary" className="bg-[#115E8D]/20 text-[#38BDF8] border border-[#38BDF8]/30 hover:bg-[#115E8D]/30 text-xs py-1 px-3 font-bold tracking-widest uppercase rounded-lg">
                             <span className="opacity-60 mr-1">{getSettingShorthand(k)}</span> {v}
                           </Badge>
                         ))
                       ) : (
                         <span className="text-[10px] font-bold text-slate-500 italic">No specific settings saved.</span>
                       )}
                     </div>
                   </div>

                   {sortedSettingsHistory.length > 0 && (
                     <div className="space-y-4 relative before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-white/5 ml-1">
                        {sortedSettingsHistory.slice(0, 5).map((historyEntry, idx) => (
                          <div key={idx} className="flex gap-4 relative">
                            <div className="w-6 h-6 rounded-full bg-[#0e171e] border-4 border-slate-800 z-10 shrink-0 flex items-center justify-center">
                              <History className="w-3 h-3 text-slate-500" />
                            </div>
                            <div>
                              <span className="text-[9px] font-black uppercase tracking-widest text-[#F06C22]">
                                {historyEntry.updatedAt?.toDate ? historyEntry.updatedAt.toDate().toLocaleDateString() : 'Unknown Date'} • {historyEntry.updatedBy}
                              </span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {Object.entries(historyEntry.settings).map(([k, v]) => (
                                  <span key={k} className="text-[10px] font-bold text-[#38BDF8] bg-[#115E8D]/20 border border-[#38BDF8]/20 px-1.5 py-0.5 rounded leading-none">
                                    {getSettingShorthand(k)}:{v}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                     </div>
                   )}
                 </CardContent>
               </Card>

               {/* Internal Trainer Notes */}
               <Card className="rounded-2xl border border-white/10 bg-[#0e171e] shadow-lg">
                 <CardContent className="p-4">
                   <div className="flex items-center justify-between mb-4">
                     <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Internal Trainer Notes</span>
                     <Badge variant="outline" className="text-[9px] font-bold tracking-widest uppercase border-white/10 text-slate-400">Practical Alignment</Badge>
                   </div>
                   
                   <div className="space-y-4 mb-6">
                     {sortedNotes.length > 0 ? (
                       sortedNotes.map(note => (
                         <div key={note.id} className={`p-4 rounded-xl border ${note.isImportant ? 'bg-red-950/30 border-red-500/30' : 'bg-black/30 border-white/5'}`}>
                            <div className="flex justify-between flex-wrap gap-2 items-start mb-2">
                              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                {note.authorName} • {note.timestamp?.toDate ? note.timestamp.toDate().toLocaleDateString() : ''}
                              </span>
                              {note.isImportant && (
                                <Badge variant="secondary" className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border-none font-bold text-[8px] uppercase tracking-widest py-0 px-1.5 leading-tight rounded flex items-center gap-1">
                                  <AlertCircle className="w-2.5 h-2.5" />
                                  Important
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm font-medium text-slate-300 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                         </div>
                       ))
                     ) : (
                       <p className="text-xs font-bold text-slate-600 italic text-center py-4">No notes recorded yet.</p>
                     )}
                   </div>

                   <div className="pt-4 border-t border-white/10">
                     <Textarea
                       placeholder="Add a new assessment or practical alignment note..."
                       value={newNoteContent}
                       onChange={(e) => setNewNoteContent(e.target.value)}
                       className="resize-none h-24 mb-3 bg-black/40 border-slate-700 text-white placeholder:text-slate-600 focus-visible:ring-[#38BDF8]"
                     />
                     <div className="flex items-center justify-between flex-wrap gap-4">
                       <div className="flex items-center space-x-2">
                         <Switch 
                           id="important-note" 
                           checked={isImportantNote} 
                           onCheckedChange={setIsImportantNote}
                           className="data-[state=checked]:bg-red-500"
                         />
                         <Label htmlFor="important-note" className="text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer flex items-center gap-1">
                           <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                           Mark as Important
                         </Label>
                       </div>
                       <Button 
                         onClick={handleSaveNote} 
                         disabled={isSavingNote || !newNoteContent.trim()}
                         className="bg-[#115E8D] hover:bg-[#0c4a70] text-white font-bold text-[10px] uppercase tracking-widest px-6 ml-auto shadow-[0_4px_20px_rgba(17,94,141,0.4)]"
                       >
                         {isSavingNote ? 'Saving...' : 'Save Note'}
                       </Button>
                     </div>
                   </div>
                 </CardContent>
               </Card>
               </>
             )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
