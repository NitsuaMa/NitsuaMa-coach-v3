import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Timer, TrendingUp, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HistoryEntry {
  weight: number;
  repsOrSeconds: number;
}

interface ExecutionSequenceCardProps {
  machineName: string;
  weight: number;
  repsOrSeconds: number;
  isStaticHold: boolean;
  history?: HistoryEntry[];
}

export function ExecutionSequenceCard({
  machineName,
  weight,
  repsOrSeconds,
  isStaticHold,
  history = [],
}: ExecutionSequenceCardProps) {
  // Sliced to max 6 entries per requirement, safely fallback
  const displayHistory = history.slice(-6);

  return (
    <Card
      className={cn(
        "relative overflow-hidden flex flex-col justify-between bg-zinc-950 text-zinc-50 border-zinc-900 shadow-sm transition-all",
        isStaticHold && "border-l-4 border-l-amber-500 bg-amber-500/5 shadow-amber-500/10"
      )}
    >
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-3">
            {/* Level 1: The Anchor */}
            <h2 className="text-2xl font-bold tracking-tight text-white leading-none">
              {machineName}
            </h2>

            {/* Level 2: The Load & Stimulus */}
            <div className="flex items-baseline gap-6 mt-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-black tracking-tighter tabular-nums leading-none">
                  {weight}
                </span>
                <span className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
                  lbs
                </span>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-black tracking-tighter tabular-nums leading-none">
                  {repsOrSeconds}
                </span>
                <span className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
                  {isStaticHold ? 'sec' : 'reps'}
                </span>
              </div>
            </div>
          </div>

          {/* Level 4: Protocol Override (TSC Badge) */}
          {isStaticHold && (
            <Badge 
              variant="outline" 
              className="px-2.5 py-1 flex items-center gap-1.5 bg-amber-500/10 text-amber-500 border-amber-500/30 uppercase tracking-widest font-bold text-[10px]"
            >
              <Timer className="w-3.5 h-3.5" />
              Static Hold / TSC
            </Badge>
          )}
        </div>
      </div>

      {/* Level 3: The Delta (History Micro-Timeline) */}
      {displayHistory.length > 0 && (
        <div className="px-5 py-3 border-t border-zinc-800/50 bg-zinc-900/30">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar whitespace-nowrap text-xs font-mono font-medium text-zinc-400">
              {displayHistory.map((entry, index) => (
                <React.Fragment key={index}>
                  <div className="flex items-baseline opacity-80 hover:opacity-100 transition-opacity">
                    <span>{entry.weight}</span>
                    <span className="text-zinc-600 mx-0.5 text-[10px]">x</span>
                    <span>{entry.repsOrSeconds}</span>
                  </div>
                  {index < displayHistory.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-zinc-700 shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
