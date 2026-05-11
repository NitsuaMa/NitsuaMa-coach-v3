import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Robust date parser for legacy and standard formats to ensure chronological sorting
 * Handles YYYY-MM-DD, MM/DD/YYYY, MM/DD, and other common formats
 */
export function parseSessionDate(dateString: string | undefined): number {
  if (!dateString) return 0;
  
  // Standard format YYYY-MM-DD
  if (dateString.includes('-') && dateString.split('-')[0].length === 4) {
    const d = new Date(dateString + 'T12:00:00');
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  // Common legacy format MM/DD or MM/DD/YY
  if (dateString.includes('/')) {
    const parts = dateString.split('/');
    if (parts.length === 2) {
      // MM/DD -> Add current year
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      let year = new Date().getFullYear();
      
      const currentMonth = new Date().getMonth() + 1; // 1-indexed
      if (parseInt(month, 10) > currentMonth) {
        year -= 1;
      }
      if (year < 2025) year = 2025;
      
      const d = new Date(`${year}-${month}-${day}T12:00:00`);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    }
    if (parts.length === 3) {
      // MM/DD/YYYY or MM/DD/YY
      let [m, day, y] = parts;
      if (y.length === 2) y = '20' + y;
      const parsedDate = new Date(`${y}-${m.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00`);
      return isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
    }
  }

  // Fallback to standard JS parsing
  const parsed = Date.parse(dateString);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Safely extract milliseconds from Firestore Timestamp, JS Date, or simple object
 */
export function getMillis(dateObj: any): number {
  if (!dateObj) return 0;
  if (typeof dateObj.toMillis === 'function') return dateObj.toMillis();
  if (typeof dateObj.getTime === 'function') return dateObj.getTime();
  if (dateObj.seconds !== undefined) return dateObj.seconds * 1000 + ((dateObj.nanoseconds || 0) / 1000000);
  try {
    const parsed = new Date(dateObj).getTime();
    return isNaN(parsed) ? 0 : parsed;
  } catch(e) {
    return 0;
  }
}

/**
 * Calculate the total volume lifted during an exercise.
 * For standard exercises: Volume = Weight * Reps.
 * For Time Static Contractions (TSC): Every 30 seconds counts as 2 reps. 
 */
export function calculateExerciseVolume(log: { weight?: string, reps?: string, isStaticHold?: boolean, isTSC?: boolean, seconds?: string }): number {
  const weight = parseInt(log.weight || '0', 10);
  if (isNaN(weight) || weight <= 0) return 0;

  if (log.isStaticHold || log.isTSC) {
    const seconds = parseInt(log.seconds || '0', 10);
    if (isNaN(seconds) || seconds <= 0) return 0;
    const equivalentReps = (seconds / 30) * 2;
    return weight * equivalentReps;
  } else {
    const reps = parseInt(log.reps || '0', 10);
    return weight * (isNaN(reps) || reps <= 0 ? 1 : reps);
  }
}
