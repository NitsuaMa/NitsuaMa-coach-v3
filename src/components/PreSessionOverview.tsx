import React, { useState, useEffect } from 'react';
import { Play, History, AlertTriangle, Activity, Settings2, Check, Loader2, Dumbbell, Calendar, Target, Edit3, X } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SessionRoutineManagerModal } from './SessionRoutineManagerModal';
import { MACHINE_LIST } from '../data/machine-database';
import { Client, Machine, ExerciseLog, Routine, WorkoutSession, TrainerFocus, SessionNote, Trainer } from '../types';

interface PreSessionOverviewProps {
  authTrainer: Trainer | null;
  client: Client;
  targetRoutine: Routine | null;
  lastSession: WorkoutSession | null;
  historicalLifts: Record<string, { last: ExerciseLog; previous: ExerciseLog | null }>;
  onStart: (routineType: 'A' | 'B' | 'Free', customMachines?: string[], note?: string) => void;
  onCancel: () => void;
  routines: Routine[];
  trainerFocuses: TrainerFocus[];
  sessionNotes: SessionNote[];
  logs?: ExerciseLog[];
}

export function PreSessionOverview({ 
  authTrainer,
  client, 
  targetRoutine, 
  lastSession, 
  historicalLifts, 
  onStart,
  onCancel,
  machines,
  routines,
  trainerFocuses,
  sessionNotes,
  logs = []
}: PreSessionOverviewProps & { machines: Machine[] }) {
  const [selectedRoutineType, setSelectedRoutineType] = useState<'A' | 'B' | 'Free' | 'Create_A' | 'Create_B'>('A');
  const [adjustedMachineIds, setAdjustedMachineIds] = useState<string[]>([]);
  const [adjustmentNote, setAdjustmentNote] = useState('');
  const [isRoutineManagerOpen, setIsRoutineManagerOpen] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNotePriority, setNewNotePriority] = useState<'High' | 'Medium' | 'Low'>('High');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [viewAllNotes, setViewAllNotes] = useState(false);

  const routineA = routines.find(r => r.name.includes('Routine A'));
  const routineB = routines.find(r => r.name.includes('Routine B'));

  useEffect(() => {
    let type: 'A' | 'B' | 'Free' | 'Create_A' | 'Create_B' = 'Create_A';
    if (targetRoutine) {
      if (targetRoutine.name.includes('Routine A')) type = 'A';
      else if (targetRoutine.name.includes('Routine B')) type = 'B';
    } else if (routineA) {
      type = 'A';
    }
    
    if (type === 'B' && !routineB) {
      type = 'Create_B';
    }

    if (selectedRoutineType !== 'Create_A') {
      setSelectedRoutineType(type);
      if ((type as string) === 'Create_B' || (type as string) === 'Free') setAdjustedMachineIds([]);
      else setAdjustedMachineIds(targetRoutine?.machineIds || routineA?.machineIds || []);
    }
  }, [targetRoutine, routineA, routineB]);

  const handleSaveNote = async () => {
    if (!newNoteContent.trim() || !authTrainer) return;
    setIsSavingNote(true);
    try {
      await addDoc(collection(db, 'sessionNotes'), {
        sessionId: 'pre-session',
        clientId: client.id,
        trainerId: authTrainer.id,
        trainerInitials: authTrainer.initials || authTrainer.fullName.substring(0, 2).toUpperCase(),
        content: newNoteContent.trim(),
        priority: newNotePriority,
        createdAt: serverTimestamp()
      });
      setNewNoteContent('');
      setNewNotePriority('High');
    } catch (e) {
      console.error("Failed to save note", e);
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleStart = () => {
    onStart(
      selectedRoutineType === 'Create_B' ? 'B' : selectedRoutineType === 'Create_A' ? 'A' : selectedRoutineType, 
      isAdjusting || ['Free', 'Create_A', 'Create_B'].includes(selectedRoutineType) ? adjustedMachineIds : undefined, 
      adjustmentNote
    );
  };

  const getAverageQuality = (machineId: string) => {
    const machineLogs = logs.filter(l => l.machineId === machineId && l.repQuality !== undefined);
    if (machineLogs.length === 0) return null;
    
    // Tiered Fallback in average calculation
    const sum = machineLogs.reduce((acc, l) => {
      const rawQ = l.repQuality!;
      const normalizedQ = (rawQ === 1 || rawQ === 2 || rawQ === 3) ? rawQ : (rawQ > 0 ? 2 : 0);
      return acc + normalizedQ;
    }, 0);
    
    const avg = sum / machineLogs.length;
    
    if (avg >= 2.5) return { grade: 'GOOD', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', label: 'Good' };
    if (avg >= 1.5) return { grade: 'COMP', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30', label: 'Completed' };
    return { grade: 'BAD', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30', label: 'Needs Work' };
  };

  const orthopedics = client.medicalHistory;
  const globalNotes = client.globalNotes;
  const clinicalFlags = client.clinicalProfile || [];
  const hasFlags = clinicalFlags.length > 0 || !!orthopedics || !!client.clinicalNotes;
  
  const selectedRoutineIds = (isAdjusting || ['Free', 'Create_A', 'Create_B'].includes(selectedRoutineType))
    ? adjustedMachineIds 
    : (selectedRoutineType === 'A' ? (routineA?.machineIds || []) : (routineB?.machineIds || []));

  const highPriorityNotes = sessionNotes.filter(n => n.priority === 'High');
  const displayNotes = viewAllNotes ? sessionNotes : highPriorityNotes;

  const lastRoutineName = lastSession 
    ? routines.find(r => r.id === lastSession.routineId)?.name || ((lastSession.sessionType as string) === 'Free' ? 'Open Session' : lastSession.sessionType)
    : 'None';
  
  const lastSessionDate = lastSession?.endTime?.toDate() 
    ? new Date(lastSession.endTime.toDate()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Never';

  const scheduledRoutineName = targetRoutine?.name || (routineA?.name || 'Routine A');

  return (
    <div className="flex-1 flex flex-col gap-6 p-6 md:p-8 h-full overflow-y-auto bg-[#0A2E46] text-[#F8F9FA] custom-scrollbar pb-32">
      
      {/* 1. Header & Main Action */}
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tighter text-white">
              {client.firstName} {client.lastName}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasFlags && (
              <div className="px-3 py-1 bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded-full flex items-center gap-2 shadow-sm">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-widest">{clinicalFlags.join(', ')}{clinicalFlags.length > 0 && orthopedics ? ' - ' : ''}{orthopedics}</span>
              </div>
            )}
            {globalNotes && (
              <div className="px-3 py-1 bg-blue-500/20 text-[#38BDF8] border border-[#38BDF8]/30 rounded-full flex items-center gap-2 shadow-sm">
                <History className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-widest max-w-[400px] truncate">{globalNotes}</span>
              </div>
            )}
          </div>
        </div>
        <Button variant="outline" onClick={onCancel} className="px-5 rounded-2xl font-bold uppercase text-[10px] tracking-widest bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300 h-10 shadow-sm transition-all hover:text-white">
          <X className="w-4 h-4 mr-2" /> Cancel
        </Button>
      </div>

      {/* 2. Routine Context Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#0e171e] p-6 rounded-[2rem] border border-[#38BDF8]/30 shadow-[0_0_20px_rgba(56,189,248,0.1)] relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
             <Target className="w-24 h-24 text-[#38BDF8]" />
           </div>
           <span className="text-[10px] font-black uppercase tracking-widest text-[#38BDF8] relative z-10">Scheduled Today</span>
           <div className="text-3xl font-black italic uppercase text-white mt-1 relative z-10 tracking-tight">
             {scheduledRoutineName}
           </div>
        </div>
        
        <div className="bg-slate-800/50 p-6 rounded-[2rem] border border-slate-700/50 relative overflow-hidden flex flex-col justify-end">
           <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
             <Calendar className="w-24 h-24 text-white" />
           </div>
           <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 relative z-10">Last Performed</span>
           <div className="text-xl font-black italic uppercase text-slate-300 mt-1 relative z-10 tracking-tight flex items-center gap-3">
             {lastRoutineName} <span className="text-sm text-slate-500 not-italic uppercase tracking-widest">on {lastSessionDate}</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column (Main Focus) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* 3. Today's Machine List & Quality Averages */}
          <div className="bg-[#0e171e] border border-slate-700/50 rounded-[2.5rem] p-6 sm:p-8 shadow-xl relative min-h-[400px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black uppercase tracking-widest text-white flex items-center gap-3">
                <Dumbbell className="w-5 h-5 text-slate-500" />
                Execution Sequence
              </h3>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsRoutineManagerOpen(true)}
                className="bg-transparent border-slate-700 hover:bg-slate-800 text-slate-300 font-bold tracking-widest uppercase text-[10px] rounded-xl h-8"
              >
                <Edit3 className="w-3.5 h-3.5 mr-2" /> Adjust Today
              </Button>
            </div>
            
            <div className="flex-1 space-y-3">
              {selectedRoutineIds.length === 0 ? (
                 <div className="flex flex-col items-center justify-center p-12 h-full opacity-50">
                   <p className="text-xs font-black uppercase tracking-widest text-[#68717A]">No machines selected</p>
                 </div>
              ) : (
                selectedRoutineIds.map((mId, idx) => {
                  const machine = machines.find(m => m.id === mId);
                  const avgQ = getAverageQuality(mId);
                  
                  return (
                    <div key={mId} className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 flex items-center justify-between group hover:border-slate-500 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0 shadow-inner">
                          <span className="text-slate-400 font-black text-[10px]">{idx + 1}</span>
                        </div>
                        <h4 className="text-sm font-black uppercase text-white truncate max-w-[200px] sm:max-w-xs">{machine?.name || mId}</h4>
                      </div>
                      
                      {avgQ ? (
                        <div className={`px-3 py-1.5 rounded-lg border ${avgQ.color} flex items-center gap-2 shrink-0`}>
                          <span className="text-[10px] font-black uppercase tracking-widest">Avg Qly: {avgQ.grade}</span>
                        </div>
                      ) : (
                        <div className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-500 flex items-center shrink-0">
                          <span className="text-[10px] font-black uppercase tracking-widest">No Data</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* 4. Routine Action Controls (Bottom of List) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-slate-800">
               <button 
                 onClick={() => { setSelectedRoutineType('A'); setAdjustedMachineIds(routineA?.machineIds || []); }}
                 className={`p-3 rounded-xl font-black italic uppercase tracking-widest text-[10px] border transition-all ${
                   selectedRoutineType === 'A' || selectedRoutineType === 'Create_A' 
                     ? 'bg-slate-700 border-slate-500 text-white shadow-md' 
                     : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white'
                 }`}
               >
                 {routineA ? 'Load Routine A' : 'Initialize Routine A'}
               </button>
               <button 
                 onClick={() => { setSelectedRoutineType('B'); setAdjustedMachineIds(routineB?.machineIds || []); }}
                 className={`p-3 rounded-xl font-black italic uppercase tracking-widest text-[10px] border transition-all ${
                   selectedRoutineType === 'B' || selectedRoutineType === 'Create_B'
                     ? 'bg-slate-700 border-slate-500 text-white shadow-md' 
                     : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white'
                 }`}
               >
                 {routineB ? 'Load Routine B' : 'Initialize Routine B'}
               </button>
               <button 
                 onClick={() => { setSelectedRoutineType('Free'); setAdjustedMachineIds([]); }}
                 className={`p-3 rounded-xl font-black italic uppercase tracking-widest text-[10px] border transition-all ${
                   selectedRoutineType === 'Free' 
                     ? 'bg-slate-700 border-slate-500 text-white shadow-md' 
                     : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white'
                 }`}
               >
                 Custom / Open Session
               </button>
            </div>
          </div>
          
        </div>

        {/* Right Column (Focus & Notes) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* 5. Trainer Focuses */}
          <div className="bg-slate-800 border border-slate-700 rounded-[2rem] p-6 shadow-lg">
             <span className="text-[10px] font-black uppercase tracking-widest text-[#38BDF8] flex items-center gap-2 mb-4">
               <Activity className="w-3.5 h-3.5" /> Overarching Goals
             </span>
             <h3 className="text-xl font-black text-white mb-4">Trainer Focuses</h3>
             {trainerFocuses.length > 0 ? (
               <ul className="space-y-3">
                 {trainerFocuses.map(focus => (
                   <li key={focus.id} className="text-sm font-medium text-slate-300 bg-slate-900/50 p-3 rounded-xl border border-slate-700/50 leading-relaxed">
                     <span className="font-bold text-[#38BDF8] block mb-1">{focus.category}</span>
                     {focus.notes}
                   </li>
                 ))}
               </ul>
             ) : (
               <p className="text-sm text-slate-500 italic font-medium">No active focuses set for this client.</p>
             )}
          </div>

          {/* 6. Prioritized Notes (Moved to Bottom) */}
          <div className="bg-[#0e171e] border border-slate-700/50 rounded-[2rem] p-6 shadow-xl flex-1 flex flex-col min-h-[400px]">
             <div className="flex justify-between items-center mb-4">
               <div>
                  <span className="text-[10px] font-black text-[#68717A] uppercase tracking-widest">Knowledge Base</span>
                  <h3 className="text-xl font-black text-white mt-1">Pre-Session Notes</h3>
               </div>
             </div>
             
             {/* Smart Filtering */}
             <div className="flex bg-slate-800/80 p-1 rounded-xl mb-4 shrink-0">
               <button
                 onClick={() => setViewAllNotes(false)}
                 className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                   !viewAllNotes ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-500 hover:text-white'
                 }`}
               >
                 High Priority
               </button>
               <button
                 onClick={() => setViewAllNotes(true)}
                 className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                   viewAllNotes ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-500 hover:text-white'
                 }`}
               >
                 All Notes
               </button>
             </div>
             
             <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2 mb-4">
               {displayNotes.length === 0 ? (
                 <p className="text-xs text-slate-500 text-center font-medium italic p-4">No notes found.</p>
               ) : (
                 displayNotes.map(note => (
                   <div key={note.id || note.createdAt?.toMillis()} className={`bg-slate-800/50 p-3.5 rounded-2xl border ${note.priority === 'High' ? 'border-l-4 border-l-amber-500 border-slate-700/50 shadow-sm' : 'border-slate-700/50'}`}>
                     <div className="flex justify-between items-start mb-2">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{note.trainerInitials || 'System'}</span>
                       <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{note.createdAt?.toDate ? new Date(note.createdAt.toDate()).toLocaleDateString() : ''}</span>
                     </div>
                     <p className="text-[13px] text-white/90 leading-relaxed font-medium">{note.content}</p>
                   </div>
                 ))
               )}
             </div>

             {/* Entry Form */}
             <div className="space-y-3 bg-slate-900/50 p-4 rounded-3xl border border-slate-800 shrink-0">
               <Textarea 
                 placeholder="Log new note..."
                 value={newNoteContent}
                 onChange={e => setNewNoteContent(e.target.value)}
                 className="bg-transparent border-none focus-visible:ring-0 text-white min-h-[60px] resize-none text-sm p-0 placeholder:text-slate-600 font-medium"
               />
               <div className="flex gap-2">
                 <Select value={newNotePriority} onValueChange={(v: any) => setNewNotePriority(v)}>
                   <SelectTrigger className="w-[110px] bg-slate-800 border-slate-700 text-white font-bold h-9 text-xs rounded-xl">
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent className="bg-slate-800 border-slate-700 text-white">
                     <SelectItem value="High" className="font-bold text-amber-500 text-xs">High</SelectItem>
                     <SelectItem value="Medium" className="font-bold text-xs">Medium</SelectItem>
                     <SelectItem value="Low" className="font-bold text-slate-400 text-xs">Low</SelectItem>
                   </SelectContent>
                 </Select>
                 <Button 
                   onClick={handleSaveNote}
                   disabled={!newNoteContent.trim() || isSavingNote}
                   className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-black uppercase tracking-widest h-9 text-[10px] rounded-xl"
                 >
                   {isSavingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Note'}
                 </Button>
               </div>
             </div>
          </div>
        </div>
      </div>

      <SessionRoutineManagerModal 
        isOpen={isRoutineManagerOpen}
        onOpenChange={setIsRoutineManagerOpen}
        currentMachineIds={selectedRoutineIds}
        machines={machines}
        onSave={(newIds) => {
          setAdjustedMachineIds(newIds);
          setIsAdjusting(true);
        }}
      />

      {/* 7. The Anchor CTA */}
      <div className="fixed bottom-[100px] right-6 md:right-8 z-50">
        <Button 
          onClick={handleStart}
          className="h-20 px-8 md:px-12 rounded-[2rem] font-black uppercase text-lg sm:text-2xl tracking-[0.2em] bg-[#F06C22] hover:bg-[#d95d18] text-white shadow-[0_10px_30px_rgba(240,108,34,0.4)] transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-4 border border-[#F06C22]/50"
        >
          <Play className="w-6 h-6 sm:w-8 sm:h-8 fill-current" />
          Start Session
        </Button>
      </div>

    </div>
  );
}

