import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

const calculateConservativeLoad = (machineId: string, bodyWeight: number, level: string) => {
  const isLowerBody = ['leg_press', 'squat', 'leg_extension', 'leg_curl'].includes(machineId.toLowerCase()) || machineId.includes('leg');
  
  let percentage = isLowerBody ? 0.40 : 0.20;
  
  if (level === 'Intermediate') {
    percentage *= 1.2;
  }
  
  if (machineId.includes('chest_press')) percentage = 0.20;
  if (machineId.includes('compound_row')) percentage = 0.25;
  if (machineId.includes('leg_press')) percentage = 0.40;

  const calculated = Math.round(bodyWeight * percentage);
  return Math.round(calculated / 5) * 5;
};

export function ClientEquipmentPrescriptions({ 
  clientId, 
  machines, 
  clientSettings, 
  clientBodyWeight 
}: any) {
  const [selectedMachine, setSelectedMachine] = useState<any>(null);
  const [fitnessLevel, setFitnessLevel] = useState('Novice');
  const [estimatedWeight, setEstimatedWeight] = useState<number | ''>('');

  const handleInitialize = (machine: any) => {
    setSelectedMachine(machine);
    const weight = calculateConservativeLoad(machine.id, clientBodyWeight || 150, 'Novice');
    setEstimatedWeight(weight);
    setFitnessLevel('Novice');
  };

  const handleFitnessLevelChange = (val: string) => {
    setFitnessLevel(val);
    if (selectedMachine) {
      setEstimatedWeight(calculateConservativeLoad(selectedMachine.id, clientBodyWeight || 150, val));
    }
  };

  const handleSave = async () => {
    if (!clientId || !selectedMachine) return;
    
    const settingId = `${clientId}_${selectedMachine.id}`;
    
    await setDoc(doc(db, 'clientMachineSettings', settingId), {
      clientId,
      machineId: selectedMachine.id,
      prescribedWeight: estimatedWeight,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    setSelectedMachine(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {machines.map((machine: any) => {
          const setting = clientSettings[machine.id];
          const hasPrescription = setting?.prescribedWeight || setting?.settings;
          
          if (hasPrescription) {
            return (
              <Card key={machine.id} className="bg-slate-800 border-slate-700 shadow-sm relative overflow-hidden flex flex-col">
                <CardHeader className="pb-2 border-b border-slate-700/50 shrink-0">
                  <CardTitle className="text-sm font-black uppercase text-white truncate">{machine.name}</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 flex flex-col flex-1">
                  <div className="flex justify-between items-center mb-auto">
                    <span className="text-xs font-semibold text-slate-400 uppercase">Prescribed Load</span>
                    <span className="text-lg font-black text-[#F06C22]">{setting.prescribedWeight ? `${setting.prescribedWeight} lbs` : '--'}</span>
                  </div>
                  {setting.settings && Object.keys(setting.settings).length > 0 && (
                    <div className="text-xs text-slate-400 space-y-1 mt-4 pt-2 border-t border-slate-700/50">
                       {Object.entries(setting.settings).map(([k, v]: any) => (
                         <div key={k} className="flex justify-between">
                           <span className="capitalize">{k}</span>
                           <span className="font-medium text-white">{v}</span>
                         </div>
                       ))}
                    </div>
                  )}
                  <Button variant="outline" size="sm" className="w-full mt-4 text-[10px] uppercase font-black shrink-0 border-slate-600 text-slate-300 hover:bg-slate-700" onClick={() => handleInitialize(machine)}>
                    Adjust Settings
                  </Button>
                </CardContent>
              </Card>
            );
          }
          
          return (
            <Card key={machine.id} className="bg-slate-900/50 border-slate-800/50 opacity-80 shadow-none relative flex flex-col">
              <div className="absolute top-3 right-3">
                <Badge variant="outline" className="bg-slate-800 text-slate-500 border-slate-700 uppercase text-[9px] font-black">Uninitiated</Badge>
              </div>
              <CardHeader className="pb-2 shrink-0">
                <CardTitle className="text-sm font-black uppercase text-slate-400 truncate pr-16">{machine.name}</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 flex flex-col flex-1 items-center justify-center min-h-[100px]">
                <Button onClick={() => handleInitialize(machine)} className="bg-slate-800 hover:bg-[#115E8D] text-slate-400 hover:text-white uppercase font-black tracking-widest text-[10px] w-full transition-colors mt-auto">
                  Initialize Setup
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!selectedMachine} onOpenChange={(open) => !open && setSelectedMachine(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="uppercase font-black text-xl italic tracking-tighter">Initialize: {selectedMachine?.name}</DialogTitle>
            <DialogDescription className="text-slate-400">
               Calculate a conservative starting load for continuous-tension protocols.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
             <Button variant="outline" className="w-full border-[#38BDF8]/30 hover:bg-[#38BDF8]/10 text-[#38BDF8] uppercase text-xs font-black" onClick={() => window.open(`/knowledge?machine=${selectedMachine?.id || ''}`, '_blank')}>
               Open Clinical Setup Guide
             </Button>
             
             <div className="bg-slate-800/80 p-4 rounded-xl space-y-4 border border-slate-700">
               <div className="flex gap-4">
                 <div className="space-y-2 flex-1">
                   <Label className="text-xs uppercase font-bold text-slate-400">Body Weight (lbs)</Label>
                   <Input 
                     type="number" 
                     className="bg-slate-900 border-slate-700 text-slate-300"
                     value={clientBodyWeight || ''}
                     disabled
                     placeholder="Not set"
                   />
                 </div>
                 <div className="space-y-2 flex-1">
                   <Label className="text-xs uppercase font-bold text-slate-400">Fitness Level</Label>
                   <Select value={fitnessLevel} onValueChange={handleFitnessLevelChange}>
                     <SelectTrigger className="bg-slate-900 border-slate-700">
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent className="bg-slate-900 border-slate-700 text-white">
                       <SelectItem value="Novice">Novice</SelectItem>
                       <SelectItem value="Intermediate">Intermediate</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
               </div>
               
               <div className="space-y-2 pt-2 border-t border-slate-700">
                 <Label className="text-xs uppercase font-bold text-[#F06C22]">Calculated Starting Load (lbs)</Label>
                 <Input 
                   type="number" 
                   value={estimatedWeight}
                   onChange={e => setEstimatedWeight(Number(e.target.value) || '')}
                   className="bg-slate-900 border-[#F06C22]/50 text-xl font-black focus-visible:ring-[#F06C22] text-white"
                 />
                 <p className="text-[10px] text-slate-500 font-medium">You can manually override this value before saving.</p>
               </div>
             </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" className="uppercase font-black text-xs text-slate-400 hover:text-white" onClick={() => setSelectedMachine(null)}>Cancel</Button>
            <Button className="bg-[#F06C22] hover:bg-[#D95B16] uppercase font-black text-xs" onClick={handleSave}>Save Prescription</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
