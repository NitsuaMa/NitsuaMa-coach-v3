// src/components/mockData.ts

export interface DemographicData {
  ageGroup: string;
  occupation: string;
  avgStrengthIncrease: number;
  avgRepQuality: number;
}

export interface ClientSessionData {
  date: string;
  expectedTUT: number;
  actualTUT: number;
  repQuality: number;
  qualityScore: 'Elite' | 'Good' | 'Poor';
  posture: number;
  pace: number;
  path: number;
  purpose: number;
}

export interface TrainerNote {
  id: string;
  date: string;
  author: string;
  text: string;
  isImportant: boolean;
}

export interface TrainerEfficacy {
  trainerName: string;
  avgRepQuality: number;
  clientCount: number;
}

export interface ReverseAgingData {
  month: string;
  baselineWeight: number;
  currentWeight: number;
}

export const mockDemographics: DemographicData[] = [
  { ageGroup: '25-34', occupation: 'Tech', avgStrengthIncrease: 42, avgRepQuality: 88 },
  { ageGroup: '35-44', occupation: 'Finance', avgStrengthIncrease: 38, avgRepQuality: 85 },
  { ageGroup: '45-54', occupation: 'Executive', avgStrengthIncrease: 31, avgRepQuality: 92 },
  { ageGroup: '55-64', occupation: 'Retired', avgStrengthIncrease: 45, avgRepQuality: 95 },
  { ageGroup: '65+', occupation: 'Retired', avgStrengthIncrease: 52, avgRepQuality: 91 },
];

export const mockClientSessions: ClientSessionData[] = [
  { date: '2026-04-01', expectedTUT: 90, actualTUT: 85, repQuality: 82, qualityScore: 'Good', posture: 4, pace: 3.5, path: 4, purpose: 4 },
  { date: '2026-04-05', expectedTUT: 90, actualTUT: 88, repQuality: 86, qualityScore: 'Good', posture: 4.5, pace: 4, path: 4, purpose: 4 },
  { date: '2026-04-10', expectedTUT: 90, actualTUT: 92, repQuality: 91, qualityScore: 'Elite', posture: 4.5, pace: 4.5, path: 4.5, purpose: 4.5 },
  { date: '2026-04-15', expectedTUT: 90, actualTUT: 75, repQuality: 65, qualityScore: 'Poor', posture: 3.5, pace: 2.5, path: 3, purpose: 3.5 },
  { date: '2026-04-20', expectedTUT: 90, actualTUT: 88, repQuality: 89, qualityScore: 'Good', posture: 4.5, pace: 4, path: 4.5, purpose: 4 },
  { date: '2026-04-27', expectedTUT: 90, actualTUT: 91, repQuality: 94, qualityScore: 'Elite', posture: 5, pace: 4.5, path: 5, purpose: 4.5 },
];

export const mockTrainerNotes: TrainerNote[] = [
  { id: '1', date: '2026-04-15', author: 'AJ', text: 'Client rushed Lower Turnaround on Leg Press today. Complained of minor lower back tension. Keep an eye on Posture.', isImportant: true },
  { id: '2', date: '2026-04-20', author: 'TR', text: 'Much better pace today. Successfully achieved 90s TUT on Leg Extension.', isImportant: false },
  { id: '3', date: '2026-04-27', author: 'TR', text: 'Client noted shoulder discomfort during overhead press. Avoid overhead movements next session.', isImportant: true },
];

export const mockTrainerEfficacy: TrainerEfficacy[] = [
  { trainerName: 'Alex J.', avgRepQuality: 94, clientCount: 15 },
  { trainerName: 'Sarah M.', avgRepQuality: 89, clientCount: 22 },
  { trainerName: 'Mike T.', avgRepQuality: 91, clientCount: 18 },
  { trainerName: 'Jenna K.', avgRepQuality: 85, clientCount: 12 },
];

export const mockReverseAgingData: ReverseAgingData[] = [
  { month: 'Jan', baselineWeight: 100, currentWeight: 100 },
  { month: 'Feb', baselineWeight: 100, currentWeight: 105 },
  { month: 'Mar', baselineWeight: 100, currentWeight: 110 },
  { month: 'Apr', baselineWeight: 100, currentWeight: 112 },
  { month: 'May', baselineWeight: 100, currentWeight: 118 },
  { month: 'Jun', baselineWeight: 100, currentWeight: 125 },
  { month: 'Jul', baselineWeight: 100, currentWeight: 128 },
  { month: 'Aug', baselineWeight: 100, currentWeight: 135 },
  { month: 'Sep', baselineWeight: 100, currentWeight: 142 },
  { month: 'Oct', baselineWeight: 100, currentWeight: 145 },
  { month: 'Nov', baselineWeight: 100, currentWeight: 150 },
  { month: 'Dec', baselineWeight: 100, currentWeight: 155 },
];
