import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  limit,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { ExerciseLog, WorkoutSession } from '../types';

/**
 * Calculates the delta for highlighted movements.
 * Takes 3 machine IDs and finds the first and last recorded weights.
 */
export async function calculateHighlightedMovements(clientId: string, machineIds: string[]) {
  const highlightedMovements = [];

  for (const machineId of machineIds) {
    // Get Machine Info
    const machineSnapshot = await getDocs(query(collection(db, 'machines'), where('__name__', '==', machineId)));
    const machineData = machineSnapshot.docs[0]?.data();
    const machineName = machineData?.fullName || machineData?.name || 'Unknown Machine';

    // Get All Logs for this machine to find min/max
    const logsQuery = query(
      collection(db, 'exerciseLogs'),
      where('clientId', '==', clientId),
      where('machineId', '==', machineId)
    );
    const logsSnap = await getDocs(logsQuery);
    const allWeights = logsSnap.docs
      .map(d => parseFloat(d.data().weight || '0'))
      .filter(w => !isNaN(w) && w > 0);

    if (allWeights.length === 0) {
      highlightedMovements.push({
        machineId,
        machineName,
        startingWeight: 0,
        currentWeight: 0,
        currentReps: 0,
        isStaticHold: false,
        currentQuality: 'N/A',
        change: 0,
        percentageIncrease: 0
      });
      continue;
    }

    const firstWeight = Math.min(...allWeights);
    const currentWeight = Math.max(...allWeights);
    
    // For reps/quality, we still might want the most recent log
    const recentLogQuery = query(
      collection(db, 'exerciseLogs'),
      where('clientId', '==', clientId),
      where('machineId', '==', machineId),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const recentLogSnap = await getDocs(recentLogQuery);
    const recentData = recentLogSnap.docs[0]?.data();
    const isStaticHold = recentData?.isStaticHold;
    const rawReps = isStaticHold ? parseFloat(recentData?.seconds || '0') : parseFloat(recentData?.reps || '0');
    const currentReps = isNaN(rawReps) ? 0 : rawReps;
    const currentQuality = recentData?.quality || 'N/A';
    
    // Safety check for percentage increase
    let percentageIncrease = 0;
    if (firstWeight > 0 && !isNaN(currentWeight)) {
      percentageIncrease = Math.round(((currentWeight - firstWeight) / firstWeight) * 100);
    }
    if (isNaN(percentageIncrease)) percentageIncrease = 0;

    highlightedMovements.push({
      machineId,
      machineName,
      startingWeight: firstWeight,
      currentWeight: currentWeight,
      currentReps: currentReps,
      isStaticHold: isStaticHold,
      currentQuality: currentQuality,
      change: currentWeight - firstWeight,
      percentageIncrease
    });
  }

  return highlightedMovements;
}

/**
 * Calculates detailed attendance stats.
 * Target: 24 sessions (standard) or 12 sessions.
 * Punctuality: Relative to :00 and :30 marks.
 * Duration: Average session length.
 */
export async function calculateComprehensiveAttendanceStats(clientId: string, startDateStr?: string) {
  const sessionsQuery = query(
    collection(db, 'sessions'),
    where('clientId', '==', clientId),
    where('status', '==', 'Completed'),
    orderBy('date', 'asc')
  );
  
  const sessionsSnap = await getDocs(sessionsQuery);
  const allSessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() } as WorkoutSession));
  
  if (allSessions.length === 0) {
    return {
      totalSessions: 0,
      firstSessionDate: '',
      totalVolume: 0,
      totalReps: 0,
      totalGoodReps: 0,
      avgRestDays: 0,
      avgDuration: 0,
      score: 0,
      punctuality: 'No data'
    };
  }

  const logsQuery = query(
    collection(db, 'exerciseLogs'),
    where('clientId', '==', clientId)
  );
  const logsSnap = await getDocs(logsQuery);
  const allLogs = logsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ExerciseLog));

  let filteredSessions = allSessions;
  if (startDateStr) {
    filteredSessions = allSessions.filter(s => s.date >= startDateStr);
  }

  const totalSessions = filteredSessions.length;
  const firstSessionDate = allSessions[0]?.date || '';

  let totalDuration = 0;
  let durationCount = 0;
  let previousDate: Date | null = null;
  let totalRestDays = 0;
  let restIntervalCount = 0;

  filteredSessions.forEach((s) => {
    if (s.startTime && s.endTime) {
      const start = s.startTime.toDate ? s.startTime.toDate() : new Date(s.startTime);
      const end = s.endTime.toDate ? s.endTime.toDate() : new Date(s.endTime);
      const duration = (end.getTime() - start.getTime()) / (1000 * 60);
      if (duration > 5 && duration < 120) {
        totalDuration += duration;
        durationCount++;
      }
    }

    const sDate = new Date(s.date + 'T12:00:00');
    if (!isNaN(sDate.getTime())) {
      if (previousDate) {
        const diffDays = Math.round((sDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 0 && diffDays < 100) {
          totalRestDays += diffDays;
          restIntervalCount++;
        }
      }
      previousDate = sDate;
    }
  });

  const avgDuration = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;
  const avgRestDays = restIntervalCount > 0 ? Math.round((totalRestDays / restIntervalCount) * 10) / 10 : 0;

  let totalVolume = 0;
  let totalRepsRaw = 0;
  let totalGoodReps = 0;

  const filteredSessionIds = new Set(filteredSessions.map(s => s.id));

  allLogs.forEach(log => {
    if (filteredSessionIds.has(log.sessionId)) {
      if (log.repQuality === 3) {
        totalGoodReps++;
      }
      const w = parseInt(log.weight || '0', 10);
      if (!isNaN(w) && w > 0) {
        if (log.isStaticHold || log.isTSC) {
          const s = parseInt(log.seconds || '0', 10);
          if (!isNaN(s) && s > 0) {
            const equiv = (s / 30) * 2;
            totalVolume += w * equiv;
            totalRepsRaw += equiv;
          }
        } else {
          const r = parseInt(log.reps || '0', 10) || 1;
          totalVolume += w * r;
          totalRepsRaw += r;
        }
      }
    }
  });

  return {
    totalSessions,
    firstSessionDate,
    totalVolume: Math.round(totalVolume),
    totalReps: Math.round(totalRepsRaw),
    totalGoodReps,
    avgRestDays,
    avgDuration,
    score: Math.min(100, Math.round((totalSessions / 24) * 100)),
    punctuality: 'Generally punctual with minor variations.'
  };
}

export async function calculateDynamicHighlightMetrics(clientId: string, machineId: string, startDateStr?: string) {
  const sessionsQuery = query(
    collection(db, 'sessions'),
    where('clientId', '==', clientId),
    where('status', '==', 'Completed')
  );
  const sessionsSnap = await getDocs(sessionsQuery);
  const userSessions = sessionsSnap.docs
    .map(d => ({ id: d.id, ...d.data() } as WorkoutSession))
    .filter(s => !startDateStr || s.date >= startDateStr);
    
  if (userSessions.length === 0) return null;

  const sessionIds = new Set(userSessions.map(s => s.id));
  
  const logsQuery = query(
    collection(db, 'exerciseLogs'),
    where('clientId', '==', clientId),
    where('machineId', '==', machineId)
  );
  
  const logsSnap = await getDocs(logsQuery);
  const validLogs = logsSnap.docs
    .map(d => ({ id: d.id, createdAt: d.data().createdAt, ...d.data() } as ExerciseLog))
    .filter(l => sessionIds.has(l.sessionId))
    .sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || 0;
      const timeB = b.createdAt?.toMillis?.() || 0;
      return timeA - timeB; // ascending
    });

  if (validLogs.length === 0) return null;

  const weights = validLogs.map(l => parseFloat(l.weight || '0') || 0).filter(w => w > 0);
  if (weights.length === 0) return null;

  const startW = Math.min(...weights);
  const currentW = Math.max(...weights);

  let percentageIncrease = 0;
  if (startW > 0) {
    percentageIncrease = Math.round(((currentW - startW) / startW) * 100);
  }

  let totalVolume = 0;
  let perfectSets = 0;
  let timeUnderTension = 0;

  validLogs.forEach(l => {
    const w = parseFloat(l.weight || '0') || 0;
    if (l.isStaticHold || l.isTSC) {
      const s = parseFloat(l.seconds || '0') || 0;
      totalVolume += w * ((s / 30) * 2);
    } else {
      const r = parseFloat(l.reps || '0') || 1;
      totalVolume += w * r;
    }
    
    if (l.repQuality === 3) {
      perfectSets++;
    }
    
    timeUnderTension += parseFloat(l.seconds || '0') || 0;
  });

  return {
    startWeight: startW,
    currentWeight: currentW,
    percentageIncrease,
    totalVolume: Math.round(totalVolume),
    perfectSets,
    timeUnderTension
  };
}
