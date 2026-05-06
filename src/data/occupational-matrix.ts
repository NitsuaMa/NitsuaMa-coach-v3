export enum PhysicalStressProfile {
  SEDENTARY_DESK = 'SEDENTARY_DESK',
  PROLONGED_STANDING = 'PROLONGED_STANDING',
  MANUAL_LABOR = 'MANUAL_LABOR',
  HEALTHCARE_CLINICAL = 'HEALTHCARE_CLINICAL',
  DYNAMIC_MIXED = 'DYNAMIC_MIXED',
  TRANSPORTATION = 'TRANSPORTATION',
  RETIRED_ACTIVE = 'RETIRED_ACTIVE',
  RETIRED_INACTIVE = 'RETIRED_INACTIVE'
}

export interface StressProfileData {
  id: PhysicalStressProfile;
  label: string;
  description: string;
  clinicalFocusMachines: string[];
  marketingKeywords: string[];
}

export const STRESS_PROFILE_MATRIX: Record<PhysicalStressProfile, StressProfileData> = {
  [PhysicalStressProfile.SEDENTARY_DESK]: {
    id: PhysicalStressProfile.SEDENTARY_DESK,
    label: 'Sedentary Desk Worker',
    description: 'Prolonged sitting resulting in anterior pelvic tilt, shortened hip flexors, weak gluteal complex, and cervical/thoracic kyphosis (forward head posture). Elevated risk of spinal disc degeneration and metabolic syndrome.',
    clinicalFocusMachines: ['Lumbar', 'Compound Row', 'Pulldown', 'Leg Press'],
    marketingKeywords: ['Desk Job', 'Back Pain', 'Posture Correction', 'Executive Health', 'Tech Neck']
  },
  [PhysicalStressProfile.PROLONGED_STANDING]: {
    id: PhysicalStressProfile.PROLONGED_STANDING,
    label: 'Prolonged Standing',
    description: 'Constant weight-bearing stress on lower extremities and lumbar spine. Risk of plantar fasciitis, varicose veins, chronic lower back fatigue, and knee joint compression.',
    clinicalFocusMachines: ['Leg Press', 'Calf Raise', 'Lumbar', 'Hip Abduction'],
    marketingKeywords: ['Retail Worker', 'Teacher', 'Standing All Day', 'Foot Pain', 'Lower Back Fatigue']
  },
  [PhysicalStressProfile.MANUAL_LABOR]: {
    id: PhysicalStressProfile.MANUAL_LABOR,
    label: 'Heavy Manual Labor',
    description: 'High repetitive strain and acute impact risks. Prone to overuse injuries in shoulders, elbows, and lumbar spine. Asymmetrical development is common depending on specific tasks.',
    clinicalFocusMachines: ['Chest Press', 'Compound Row', 'Overhead Press', 'Torso Rotation'],
    marketingKeywords: ['Tradesman', 'Construction', 'Joint Protection', 'Injury Prevention', 'Longevity']
  },
  [PhysicalStressProfile.HEALTHCARE_CLINICAL]: {
    id: PhysicalStressProfile.HEALTHCARE_CLINICAL,
    label: 'Healthcare & Clinical',
    description: 'Mixed dynamic movement, patient transferring (high shear force on lumbar), and frequent bending/reaching. High incidence of asymmetrical spinal loading and chronic stress.',
    clinicalFocusMachines: ['Lumbar', 'Leg Press', 'Compound Row', 'Bicep'],
    marketingKeywords: ['Nurse', 'Doctor', 'Shift Work', 'Back Protection', 'Occupational Hazard']
  },
  [PhysicalStressProfile.DYNAMIC_MIXED]: {
    id: PhysicalStressProfile.DYNAMIC_MIXED,
    label: 'Dynamic / Mixed Movement',
    description: 'Intermittent periods of sitting, standing, and walking. Requires a balanced full-body conditioning approach to maintain overall metabolic and structural health.',
    clinicalFocusMachines: ['Leg Press', 'Chest Press', 'Pulldown', 'Leg Curl'],
    marketingKeywords: ['Sales', 'Real Estate', 'Busy Professional', 'Time Efficient Workout']
  },
  [PhysicalStressProfile.TRANSPORTATION]: {
    id: PhysicalStressProfile.TRANSPORTATION,
    label: 'Transportation & Driving',
    description: 'Continuous seated posture exacerbated by vehicular vibration. High incidence of severe lumbar disc issues, poor circulation, and extremely tight anterior chains.',
    clinicalFocusMachines: ['Lumbar', 'Leg Press', 'Chest Fly', 'Leg Extension'],
    marketingKeywords: ['Driver', 'Pilot', 'Commuter', 'Sciatica', 'Circulation']
  },
  [PhysicalStressProfile.RETIRED_ACTIVE]: {
    id: PhysicalStressProfile.RETIRED_ACTIVE,
    label: 'Active Retiree',
    description: 'Engages in recreational physical activities (golf, tennis, hiking). Focus is on maintaining explosive power (type II muscle fibers), joint stability, and tendon resilience.',
    clinicalFocusMachines: ['Leg Press', 'Torso Rotation', 'Chest Press', 'Compound Row'],
    marketingKeywords: ['Golf Fitness', 'Tennis', 'Active Aging', 'Joint Health', 'Performance']
  },
  [PhysicalStressProfile.RETIRED_INACTIVE]: {
    id: PhysicalStressProfile.RETIRED_INACTIVE,
    label: 'Inactive Retiree',
    description: 'Low physical demand resulting in rapid sarcopenia, bone mineral density loss (osteopenia/osteoporosis), and reduced basal metabolic rate. High fall risk.',
    clinicalFocusMachines: ['Leg Press', 'Hip Adduction', 'Hip Abduction', 'Lumbar'],
    marketingKeywords: ['Fall Prevention', 'Bone Density', 'Osteoporosis', 'Senior Fitness', 'Muscle Loss']
  }
};

export interface OccupationEntry {
  id: string;
  label: string;
  category: 'Corporate & Tech' | 'Healthcare' | 'Trades & Manual Labor' | 'Public Service' | 'Education & Retail' | 'Retired';
  stressProfile: PhysicalStressProfile;
}

export const OCCUPATIONS: OccupationEntry[] = [
  // Corporate & Tech
  { id: 'occ-software', label: 'Software Engineer', category: 'Corporate & Tech', stressProfile: PhysicalStressProfile.SEDENTARY_DESK },
  { id: 'occ-executive', label: 'C-Suite Executive', category: 'Corporate & Tech', stressProfile: PhysicalStressProfile.SEDENTARY_DESK },
  { id: 'occ-finance', label: 'Finance / Accountant', category: 'Corporate & Tech', stressProfile: PhysicalStressProfile.SEDENTARY_DESK },
  { id: 'occ-sales', label: 'Outside Sales', category: 'Corporate & Tech', stressProfile: PhysicalStressProfile.DYNAMIC_MIXED },
  { id: 'occ-admin', label: 'Administrative Assistant', category: 'Corporate & Tech', stressProfile: PhysicalStressProfile.SEDENTARY_DESK },

  // Healthcare
  { id: 'occ-rn', label: 'Registered Nurse', category: 'Healthcare', stressProfile: PhysicalStressProfile.HEALTHCARE_CLINICAL },
  { id: 'occ-md', label: 'Physician / Surgeon', category: 'Healthcare', stressProfile: PhysicalStressProfile.HEALTHCARE_CLINICAL },
  { id: 'occ-dental', label: 'Dentist / Hygienist', category: 'Healthcare', stressProfile: PhysicalStressProfile.HEALTHCARE_CLINICAL }, // Notably asymmetrical
  { id: 'occ-pt', label: 'Physical Therapist', category: 'Healthcare', stressProfile: PhysicalStressProfile.DYNAMIC_MIXED },

  // Trades & Manual Labor
  { id: 'occ-construction', label: 'Construction Worker', category: 'Trades & Manual Labor', stressProfile: PhysicalStressProfile.MANUAL_LABOR },
  { id: 'occ-electrician', label: 'Electrician', category: 'Trades & Manual Labor', stressProfile: PhysicalStressProfile.MANUAL_LABOR },
  { id: 'occ-plumber', label: 'Plumber', category: 'Trades & Manual Labor', stressProfile: PhysicalStressProfile.MANUAL_LABOR },
  { id: 'occ-mechanic', label: 'Auto Mechanic', category: 'Trades & Manual Labor', stressProfile: PhysicalStressProfile.MANUAL_LABOR },
  { id: 'occ-driver', label: 'Commercial Driver', category: 'Trades & Manual Labor', stressProfile: PhysicalStressProfile.TRANSPORTATION },

  // Public Service
  { id: 'occ-police', label: 'Law Enforcement', category: 'Public Service', stressProfile: PhysicalStressProfile.DYNAMIC_MIXED },
  { id: 'occ-fire', label: 'Firefighter', category: 'Public Service', stressProfile: PhysicalStressProfile.MANUAL_LABOR },
  { id: 'occ-military', label: 'Military Personnel', category: 'Public Service', stressProfile: PhysicalStressProfile.MANUAL_LABOR },
  { id: 'occ-postal', label: 'Postal / Delivery Worker', category: 'Public Service', stressProfile: PhysicalStressProfile.PROLONGED_STANDING },

  // Education & Retail
  { id: 'occ-teacher', label: 'Teacher / Educator', category: 'Education & Retail', stressProfile: PhysicalStressProfile.PROLONGED_STANDING },
  { id: 'occ-retail', label: 'Retail Associate', category: 'Education & Retail', stressProfile: PhysicalStressProfile.PROLONGED_STANDING },
  { id: 'occ-hospitality', label: 'Bartender / Server', category: 'Education & Retail', stressProfile: PhysicalStressProfile.PROLONGED_STANDING },
  { id: 'occ-chef', label: 'Chef / Line Cook', category: 'Education & Retail', stressProfile: PhysicalStressProfile.PROLONGED_STANDING },
  { id: 'occ-manager', label: 'Store Manager', category: 'Education & Retail', stressProfile: PhysicalStressProfile.DYNAMIC_MIXED },

  // Retired
  { id: 'occ-ret-active', label: 'Retired (Active Lifetime)', category: 'Retired', stressProfile: PhysicalStressProfile.RETIRED_ACTIVE },
  { id: 'occ-ret-sedentary', label: 'Retired (Sedentary Lifetime)', category: 'Retired', stressProfile: PhysicalStressProfile.RETIRED_INACTIVE }
];
