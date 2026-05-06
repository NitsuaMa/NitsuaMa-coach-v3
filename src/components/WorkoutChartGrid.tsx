
import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  Dumbbell, 
  Settings,
  X,
  Plus,
  ArrowRight,
  TrendingUp,
  History,
  Activity,
  UserCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit, 
  setDoc,
  doc,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Client, Machine, WorkoutSession, ExerciseLog, ClientMachineSetting, Routine } from '../types';
import { cn } from '@/lib/utils';
import { OperationType, handleFirestoreError } from '../lib/firestore-errors';
import { parseSessionDate } from '../lib/utils';

interface WorkoutChartGridProps {
  clientId: string;
  clients: Client[];
  machines: Machine[];
  routines: Routine[];
  onBack: () => void;
  user?: any;
}

export function WorkoutChartGrid({ 
  clientId, 
  clients, 
  machines,
  routines,
  onBack,
  user
}: WorkoutChartGridProps) {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [clientSettings, setClientSettings] = useState<ClientMachineSetting[]>([]);
  const [editingSettings, setEditingSettings] = useState<{machineId: string, settings: Record<string, string>} | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Filtering states
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'A' | 'B'>('ALL');
  const [machineSearchQuery, setMachineSearchQuery] = useState('');
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const client = clients.find(c => c.id === clientId);
  if (!client) return null;

  // Real-time Data Fetching for this specific client
  useEffect(() => {
    if (!clientId || !user) return;

    // Full Session History
    const sessionsQ = query(
      collection(db, 'sessions'),
      where('clientId', '==', clientId),
      where('status', '==', 'Completed'),
      orderBy('date', 'desc') // No limit, need full history
    );

    const unsubscribeSessions = onSnapshot(sessionsQ, (snap) => {
      const sessData = snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkoutSession));
      sessData.sort((a, b) => parseSessionDate(b.date) - parseSessionDate(a.date));
      // Grid view: Left -> Right: Oldest -> Newest
      setSessions(sessData.reverse());
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sessions');
    });

    // Client Settings (Master Reference)
    const settingsQ = query(
      collection(db, 'clientMachineSettings'),
      where('clientId', '==', clientId)
    );

    const unsubscribeSettings = onSnapshot(settingsQ, (snap) => {
      setClientSettings(snap.docs.map(d => ({ id: d.id, ...d.data() } as ClientMachineSetting)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'clientMachineSettings');
    });

    // Real-time Exercise Logs for full history
    const logsQ = query(
      collection(db, 'exerciseLogs'),
      where('clientId', '==', clientId)
    );

    const unsubscribeLogs = onSnapshot(logsQ, (snap) => {
      const logsData = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExerciseLog));
      setExerciseLogs(logsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'exerciseLogs');
    });

    return () => {
      unsubscribeSessions();
      unsubscribeSettings();
      unsubscribeLogs();
    };
  }, [clientId, user]);

  useEffect(() => {
    // Auto-scroll to the far right (newest sessions) when sessions are loaded
    if (scrollContainerRef.current) {
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
        }
      }, 0);
    }
  }, [sessions]);

  const handleUpdateSettings = async () => {
    if (!editingSettings || !clientId) return;
    setIsSaving(true);
    try {
      const settingId = `${clientId}_${editingSettings.machineId}`;
      await setDoc(doc(db, 'clientMachineSettings', settingId), {
        clientId,
        machineId: editingSettings.machineId,
        settings: editingSettings.settings,
        updatedBy: auth.currentUser?.email || 'Unknown',
        updatedAt: serverTimestamp()
      }, { merge: true });
      setEditingSettings(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `clientMachineSettings/${editingSettings.machineId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const getLog = (machineId: string, sessionId: string) => {
    return exerciseLogs.find(l => l.machineId === machineId && l.sessionId === sessionId);
  };

  const getSetting = (machineId: string) => {
    return clientSettings.find(s => s.machineId === machineId)?.settings || {};
  };

  const filteredSortedMachines = [...machines]
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .filter(m => {
      // Name Search
      if (machineSearchQuery && !m.name.toLowerCase().includes(machineSearchQuery.toLowerCase())) return false;
      
      // Routine Filter
      if (activeFilter === 'ALL') return true;
      const targetRoutine = routines.find(r => r.name === `Routine ${activeFilter}`);
      if (!targetRoutine) return false;
      return targetRoutine.machineIds.includes(m.id!);
    });

  return (
    <div className="fixed inset-0 bg-white z-[100] flex flex-col overflow-hidden font-sans">
      {/* High-Impact Header - Optimized for iPad Contrast */}
      <header className="h-20 bg-zinc-950 px-6 sm:px-8 flex items-center justify-between shrink-0 border-b-4 border-rose-600">
        <div className="flex items-center gap-6">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack}
            className="rounded-xl h-10 w-10 sm:h-12 sm:w-12 bg-zinc-900 border-2 border-zinc-800 text-white hover:bg-zinc-800 transition-all active:scale-95"
          >
            <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
          </Button>
          
          <div className="space-y-0.5">
            <h1 className="text-2xl sm:text-3xl font-black italic tracking-tighter uppercase text-white leading-none">
              {client.firstName} {client.lastName}
            </h1>
            <div className="flex items-center gap-3">
              <Badge className="bg-rose-600 text-white text-[8px] font-black uppercase tracking-[0.2em] px-2 h-4 border-none">
                Expanded Matrix
              </Badge>
              <div className="hidden sm:flex gap-1.5 ml-4">
                <Button
                  size="sm"
                  onClick={() => setActiveFilter('ALL')}
                  className={cn(
                    "h-6 px-3 rounded-md text-[9px] font-black uppercase tracking-widest border-none transition-all",
                    activeFilter === 'ALL' 
                      ? "bg-rose-600 text-white shadow-[0_0_10px_rgba(225,29,72,0.4)]" 
                      : "bg-zinc-900 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                  )}
                >
                  All Machines
                </Button>
                <Button
                  size="sm"
                  onClick={() => setActiveFilter('A')}
                  className={cn(
                    "h-6 px-3 rounded-md text-[9px] font-black uppercase tracking-widest border-none transition-all",
                    activeFilter === 'A' 
                      ? "bg-rose-600 text-white shadow-[0_0_10px_rgba(225,29,72,0.4)]" 
                      : "bg-zinc-900 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                  )}
                >
                  Routine A
                </Button>
                {client.isRoutineBActive && (
                  <Button
                    size="sm"
                    onClick={() => setActiveFilter('B')}
                    className={cn(
                      "h-6 px-3 rounded-md text-[9px] font-black uppercase tracking-widest border-none transition-all",
                      activeFilter === 'B' 
                        ? "bg-rose-600 text-white shadow-[0_0_10px_rgba(225,29,72,0.4)]" 
                        : "bg-zinc-900 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                    )}
                  >
                    Routine B
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-8">
           <div className="hidden md:flex items-center mr-4">
             <div className="relative">
               <input 
                 type="text" 
                 placeholder="SEARCH MACHINES..." 
                 value={machineSearchQuery}
                 onChange={(e) => setMachineSearchQuery(e.target.value)}
                 className="h-10 bg-zinc-900 border-2 border-zinc-800 rounded-xl px-4 pl-10 text-[10px] font-black uppercase tracking-widest text-white placeholder:text-zinc-600 focus:outline-none focus:border-rose-600 w-[200px]"
               />
               <Dumbbell className="w-4 h-4 text-zinc-600 absolute left-3 top-1/2 -translate-y-1/2" />
             </div>
           </div>
           
           <div className="text-right">
              <p className="text-[8px] font-black uppercase text-zinc-500 tracking-widest leading-none mb-1">Historical Span</p>
              <p className="text-lg sm:text-2xl font-black italic text-white tracking-tighter leading-none">{sessions.length} Sessions</p>
           </div>
           <Activity className="w-8 h-8 text-rose-500 opacity-50 hidden sm:block" />
        </div>
      </header>

      {/* Grid Container with Sticky logic */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto relative bg-[#fcfcfc] custom-scrollbar scroll-smooth">
        <table className="border-collapse table-fixed min-w-max w-full">
          <thead>
            <tr className="sticky top-0 z-50">
              {/* Sticky Corner Corner */}
              <th className="sticky left-0 z-50 w-[180px] sm:w-[200px] h-[50px] bg-zinc-950 border-r border-b border-rose-600/20 px-3 sm:px-4 text-left shadow-md">
                 <div className="flex flex-col">
                    <h3 className="text-[12px] sm:text-[14px] font-black italic uppercase tracking-tighter text-white leading-none">Machine & Setup</h3>
                 </div>
              </th>

              {/* Session Column Headers */}
              {sessions.map((session, idx) => (
                <th 
                  key={session.id || idx} 
                  className="w-[84px] h-[50px] bg-zinc-900 border-r border-b border-zinc-800 px-1 text-center group transition-colors hover:bg-zinc-800"
                >
                  <div className="flex flex-col items-center justify-center space-y-0.5">
                     <span className="text-rose-500 font-black italic text-[9px] leading-none">
                        S#{session.sessionNumber || sessions.length - idx}
                     </span>
                     <p className="text-[12px] font-black tracking-tighter text-white tabular-nums leading-none">
                       {new Date(parseSessionDate(session.date)).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })}
                     </p>
                  </div>
                </th>
              ))}
              {/* Fillers to ensure columns span screen if few sessions exist */}
              {Array.from({ length: Math.max(0, 11 - sessions.length) }).map((_, i) => (
                <th key={`empty-h-${i}`} className="w-[84px] h-[50px] bg-zinc-950/50 border-r border-b border-zinc-800 opacity-20" />
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-200">
            {filteredSortedMachines.map((machine) => {
              const currentSettings = getSetting(machine.id!);
              
              return (
                <tr key={machine.id} className="group hover:bg-rose-50/30 transition-colors h-[48px]">
                  {/* Sticky Machine Name & Settings (The Master Reference) */}
                  <th className="sticky left-0 z-30 w-[180px] sm:w-[200px] bg-white border-r border-zinc-200 px-2.5 py-1 text-left group-hover:bg-rose-50/50 transition-colors shadow-[2px_0_10px_rgba(0,0,0,0.02)]">
                    <div className="flex flex-col h-full justify-center space-y-0.5">
                      <div className="flex items-center gap-1.5">
                         <div className="w-4 h-4 rounded-md bg-zinc-900 flex items-center justify-center shrink-0 shadow-sm shadow-zinc-200">
                            <Dumbbell className="w-2.5 h-2.5 text-white" />
                         </div>
                         <h4 className="text-[10px] sm:text-[11px] font-black italic uppercase tracking-tighter text-zinc-900 leading-tight truncate flex-1">
                            {machine.name}
                            {clientSettings.find(s => s.machineId === machine.id)?.machineNotes?.some(n => n.isImportant) && (
                              <AlertCircle className="w-2.5 h-2.5 text-red-500 shrink-0 inline ml-1" />
                            )}
                         </h4>
                      </div>

                      {/* Settings Component - TAP TO EDIT */}
                      <div 
                        onClick={() => setEditingSettings({ machineId: machine.id!, settings: { ...currentSettings } })}
                        className="flex flex-wrap gap-x-2 gap-y-0 bg-zinc-50/50 px-1 py-0.5 rounded-md border border-zinc-100 hover:border-rose-600/40 hover:bg-white transition-all cursor-pointer group/settings mt-0.5"
                      >
                         {clientSettings.find(s => s.machineId === machine.id)?.settings && Object.entries(clientSettings.find(s => s.machineId === machine.id)?.settings || {}).map(([opt, val]) => (
                           <div key={opt} className="flex items-baseline gap-0.5">
                              <span className="text-[7px] font-black uppercase tracking-tighter text-zinc-400 group-hover/settings:text-rose-500 transition-colors line-clamp-1 truncate max-w-[40px]">
                                {opt}:
                              </span>
                              <span className="text-[9px] font-black text-zinc-800 tabular-nums leading-none">
                                {val}
                              </span>
                           </div>
                         ))}
                         {(!currentSettings || Object.keys(currentSettings).length === 0) && (
                            <span className="text-[7px] font-black uppercase text-zinc-300 italic">No config</span>
                         )}
                      </div>
                    </div>
                  </th>

                  {/* Weight / Reps History Cells */}
                  {sessions.map((session) => {
                    const log = getLog(machine.id!, session.id!);
                    return (
                      <td key={session.id} className="w-[84px] px-1 border-r border-zinc-100 text-center align-middle hover:bg-black/[0.02]">
                         {log ? (
                           <div className="flex flex-col items-center justify-center">
                              <div className="flex items-baseline gap-0.5">
                                 <span className="text-[14px] font-black tracking-tighter text-zinc-900 tabular-nums leading-none">
                                   {log.weight}
                                 </span>
                              </div>
                              <div className="inline-flex items-center gap-0.5 mt-0.5 px-1 py-0.5 bg-zinc-100 rounded-[4px]">
                                 <span className={`text-[9px] font-black tabular-nums leading-none ${
                                    log.repQuality === 3 ? 'text-emerald-600' : 
                                    log.repQuality === 2 ? 'text-amber-600' : 
                                    log.repQuality === 1 ? 'text-rose-600' : 
                                    'text-zinc-700'
                                 }`}>
                                   {log.repsLeft !== undefined && log.repsRight !== undefined ? (
                                      `${log.repsLeft}L|${log.repsRight}R`
                                    ) : (
                                      log.isStaticHold ? (log.seconds || '--') : (log.reps || '--')
                                    )}
                                 </span>
                                 <span className="text-[7px] font-black uppercase text-zinc-400 tabular-nums">
                                    {log.repsLeft !== undefined && log.repsRight !== undefined ? '' : (log.isStaticHold ? 's' : 'r')}
                                 </span>
                              </div>
                           </div>
                         ) : (
                           <div className="flex items-center justify-center opacity-10">
                              <div className="w-1 h-1 rounded-full bg-zinc-400" />
                           </div>
                         )}
                      </td>
                    );
                  })}
                  {/* Fillers for empty sessions */}
                  {Array.from({ length: Math.max(0, 11 - sessions.length) }).map((_, i) => (
                    <td key={`empty-c-${i}`} className="w-[84px] bg-zinc-950/[0.02]" />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* FOOTER / STATUS BAR */}
      <footer className="h-16 bg-white border-t-2 border-zinc-100 px-8 flex items-center justify-between text-zinc-400 text-[10px] font-black uppercase tracking-widest shrink-0">
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-rose-600" />
               <span>Live Studio Sync Active</span>
            </div>
            <div className="w-px h-6 bg-zinc-100" />
            <span>iPad Native Layout Optimized</span>
         </div>
         <p>© 2026 Imagine Strength Analytics</p>
      </footer>

      {/* SETTINGS EDITOR DIALOG */}
      <Dialog open={!!editingSettings} onOpenChange={() => setEditingSettings(null)}>
        <DialogContent className="max-w-2xl rounded-[40px] border-none shadow-2xl p-0 overflow-hidden">
          <div className="bg-zinc-950 p-10 flex items-center justify-between text-white">
             <div>
                <h2 className="text-3xl font-black italic uppercase tracking-tighter truncate max-w-[400px]">
                   {machines.find(m => m.id === editingSettings?.machineId)?.name}
                </h2>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500 mt-2">Physical Configuration Mode</p>
             </div>
             <Settings className="w-10 h-10 text-white/20 animate-spin-slow" />
          </div>

          <div className="p-12 space-y-10 bg-white">
             <div className="grid grid-cols-2 gap-8">
                {editingSettings && machines.find(m => m.id === editingSettings.machineId)?.settingOptions?.map(opt => (
                   <div key={opt} className="space-y-4">
                      <label className="text-xs font-black uppercase tracking-widest text-zinc-500 ml-1">{opt}</label>
                      <Input 
                        value={editingSettings.settings[opt] || ''}
                        onChange={(e) => setEditingSettings({
                          ...editingSettings,
                          settings: { ...editingSettings.settings, [opt]: e.target.value }
                        })}
                        placeholder="--"
                        className="h-20 rounded-3xl border-2 border-zinc-100 focus:border-rose-600 focus:ring-rose-600 text-2xl font-black text-zinc-900 px-6 tabular-nums transition-all shadow-sm"
                      />
                   </div>
                ))}
             </div>

             <div className="flex items-center gap-4 pt-6">
                <Button 
                  disabled={isSaving}
                  onClick={handleUpdateSettings}
                  className="flex-1 h-24 rounded-[32px] bg-zinc-950 text-white font-black uppercase italic tracking-widest text-lg shadow-2xl active:scale-95 transition-all hover:bg-rose-600"
                >
                  {isSaving ? 'Synchronizing...' : 'Update Master Settings'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setEditingSettings(null)}
                  className="h-24 px-10 rounded-[32px] border-2 font-black uppercase text-xs"
                >
                  Discard
                </Button>
             </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
