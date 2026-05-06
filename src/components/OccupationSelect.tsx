import React, { useMemo } from 'react';
import { 
  Select, 
  SelectContent, 
  SelectGroup, 
  SelectItem, 
  SelectLabel, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { OCCUPATIONS, OccupationEntry } from '../data/occupational-matrix';

export interface OccupationSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function OccupationSelect({ value, onChange, disabled }: OccupationSelectProps) {
  // Group occupations by category
  const groupedOccupations = useMemo(() => {
    return OCCUPATIONS.reduce((acc, occ) => {
      if (!acc[occ.category]) {
        acc[occ.category] = [];
      }
      acc[occ.category].push(occ);
      return acc;
    }, {} as Record<string, OccupationEntry[]>);
  }, []);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-12 bg-white border border-slate-200 text-slate-900 focus:ring-[#F06C22] rounded-xl font-bold disabled:opacity-50 hover:bg-slate-50 transition-colors w-full shadow-sm">
        <SelectValue placeholder={disabled ? "N/A" : "Select Client Occupation..."} />
      </SelectTrigger>
      <SelectContent className="bg-white border-slate-200 rounded-xl max-h-[300px] shadow-2xl">
        {(Object.entries(groupedOccupations) as [string, OccupationEntry[]][]).map(([category, occupations]) => (
          <SelectGroup key={category} className="border-b border-slate-100 last:border-0 pb-1 mb-1 last:pb-0 last:mb-0">
            <SelectLabel className="font-black text-[10px] uppercase tracking-widest text-slate-500 py-2 px-3">
              {category}
            </SelectLabel>
            {occupations.map((occ) => (
              <SelectItem 
                key={occ.id} 
                value={occ.id}
                className="font-bold text-slate-800 focus:bg-[#38BDF8]/10 focus:text-[#0A2E46] cursor-pointer rounded-lg mx-1 py-2 text-sm"
              >
                {occ.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
