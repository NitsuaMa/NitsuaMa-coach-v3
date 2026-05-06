import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Machine } from '../types';
import { Trash2, Plus, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentMachineIds: string[];
  machines: Machine[];
  onSave: (newMachineIds: string[]) => void;
}

function SortableMachineItem({ id, machine, onRemove }: { id: string, machine: Machine, onRemove: () => void, key?: React.Key }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-4 p-4 rounded-2xl border transition-all select-none touch-none cursor-grab active:cursor-grabbing ${
        isDragging 
          ? 'bg-slate-800 border-[#38BDF8] shadow-[0_0_30px_rgba(56,189,248,0.3)] scale-[1.02] z-50 relative' 
          : 'bg-slate-800 border-slate-700 hover:border-slate-600'
      }`}
    >
      <div className="p-1 -ml-1 text-slate-500 transition-colors select-none touch-none">
        <GripVertical className="w-6 h-6" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="font-black text-base text-white truncate">{machine.name}</div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">Target: {machine.targetMuscles || 'General'}</div>
      </div>
      
      <button 
        onClick={onRemove} 
        onPointerDown={(e) => e.stopPropagation()}
        className="p-2 text-rose-400 hover:text-rose-100 hover:bg-rose-500/20 rounded-xl transition-colors shrink-0 relative z-[60]"
      >
        <Trash2 className="w-5 h-5" />
      </button>
    </div>
  );
}

export function SessionRoutineManagerModal({ isOpen, onOpenChange, currentMachineIds, machines, onSave }: Props) {
  const [editedIds, setEditedIds] = useState<string[]>([]);
  const [quickAddId, setQuickAddId] = useState<string>('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (isOpen) {
      setEditedIds([...currentMachineIds]);
      setQuickAddId('');
    }
  }, [isOpen, currentMachineIds]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setEditedIds((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleRemove = (machineIdToRemove: string) => {
    setEditedIds(editedIds.filter(id => id !== machineIdToRemove));
  };

  const handleAdd = () => {
    if (quickAddId && !editedIds.includes(quickAddId)) {
      setEditedIds([...editedIds, quickAddId]);
      setQuickAddId('');
    }
  };

  const handleSave = () => {
    onSave(editedIds);
    onOpenChange(false);
  };

  const availableMachines = machines.filter(m => !editedIds.includes(m.id!));

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-slate-900 border-none rounded-[32px] overflow-hidden p-0 shadow-2xl">
        <DialogHeader className="p-8 bg-slate-800/50 border-b border-slate-800">
          <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter text-white">Edit Session Routine</DialogTitle>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Changes apply to this active session only.</p>
        </DialogHeader>

        <div className="p-8 bg-slate-900 overflow-y-auto max-h-[60vh] custom-scrollbar">
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={editedIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {editedIds.map((machineId) => {
                  const machine = machines.find(m => m.id === machineId);
                  if (!machine) return null;
                  return (
                    <SortableMachineItem 
                      key={machineId}
                      id={machineId}
                      machine={machine}
                      onRemove={() => handleRemove(machineId)}
                    />
                  );
                })}
                {editedIds.length === 0 && (
                  <div className="py-12 text-center text-slate-500 font-bold text-sm uppercase tracking-widest border-2 border-dashed border-slate-800 rounded-2xl">
                    No active machines in session
                  </div>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        <div className="p-8 bg-slate-800/80 border-t border-slate-800">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Select value={quickAddId} onValueChange={setQuickAddId}>
                  <SelectTrigger className="w-full h-12 bg-slate-900 border-slate-700 text-white rounded-xl focus:ring-[#38BDF8]">
                    <SelectValue placeholder="Quick add machine..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[250px] bg-slate-800 border-slate-700 text-white rounded-xl">
                    {availableMachines.map(m => (
                      <SelectItem key={m.id!} value={m.id!} className="py-3 hover:bg-slate-700 focus:bg-slate-700 focus:text-white">
                        <div className="flex flex-col">
                          <span className="font-bold">{m.name}</span>
                          <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{m.targetMuscles || 'General'}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAdd} disabled={!quickAddId} className="h-12 w-12 bg-[#38BDF8] hover:bg-[#0284c7] text-white rounded-xl shrink-0 transition-colors shadow-[0_0_15px_rgba(56,189,248,0.3)]">
                <Plus className="w-6 h-6" />
              </Button>
            </div>
            <Button onClick={handleSave} className="w-full h-12 bg-[#F06C22] hover:bg-[#d95d18] text-white font-black uppercase italic tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(240,108,34,0.3)]">
              Save Session Sequence
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
