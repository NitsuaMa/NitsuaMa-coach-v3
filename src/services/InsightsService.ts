import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { DashboardAggregatedData } from '../data/insights-logic';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

const GLOBAL_INSIGHTS_CACHE_KEY = 'msf_global_insights_cache';
const CACHE_EXPIRATION_MS = 12 * 60 * 60 * 1000; // 12 hours

interface CachedInsights {
  timestamp: number;
  data: DashboardAggregatedData;
}

export class InsightsService {
  /**
   * Fetches the nightly aggregated insights document from Firestore.
   * Utilizes sessionStorage to aggressively cache the result for 12 hours,
   * protecting against excessive Firestore read costs.
   */
  static async fetchGlobalInsights(): Promise<DashboardAggregatedData | null> {
    try {
      // 1. Check Cache
      const cachedString = sessionStorage.getItem(GLOBAL_INSIGHTS_CACHE_KEY);
      if (cachedString) {
        const cached: CachedInsights = JSON.parse(cachedString);
        const isExpired = Date.now() - cached.timestamp > CACHE_EXPIRATION_MS;
        
        if (!isExpired && cached.data) {
          console.debug('[InsightsService] Serving global insights from cache.');
          return cached.data;
        } else {
          console.debug('[InsightsService] Cache expired, fetching fresh data.');
          sessionStorage.removeItem(GLOBAL_INSIGHTS_CACHE_KEY);
        }
      }

      // 2. Fetch from Firestore
      console.debug('[InsightsService] Fetching global insights from Firestore.');
      const docRef = doc(db, 'aggregations', 'global_insights');
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as DashboardAggregatedData;
        
        // 3. Cache the valid result
        const cachePayload: CachedInsights = {
          timestamp: Date.now(),
          data
        };
        sessionStorage.setItem(GLOBAL_INSIGHTS_CACHE_KEY, JSON.stringify(cachePayload));
        
        return data;
      } else {
        console.warn('[InsightsService] No global insights document found. Returning mock fallback data for UI demo.');
        
        // Massive Mock Data Fallback for Leadership Usability Review
        const mockFallback: DashboardAggregatedData = {
          timeToTrend: [
            { machineId: 'lumbar_ext', machineName: 'Lumbar Extension', demographicCohort: 'Sedentary Desk', averageSessionsToTrend: 6, averageWeeksToTrend: 3, baselineOperationalLoad: 90, trendOperationalLoad: 108 },
            { machineId: 'lumbar_ext', machineName: 'Lumbar Extension', demographicCohort: 'Manual Labor', averageSessionsToTrend: 12, averageWeeksToTrend: 6, baselineOperationalLoad: 150, trendOperationalLoad: 180 },
            { machineId: 'leg_press', machineName: 'Leg Press', demographicCohort: 'Sedentary Desk', averageSessionsToTrend: 8, averageWeeksToTrend: 4, baselineOperationalLoad: 200, trendOperationalLoad: 240 },
            { machineId: 'leg_press', machineName: 'Leg Press', demographicCohort: 'Manual Labor', averageSessionsToTrend: 16, averageWeeksToTrend: 8, baselineOperationalLoad: 350, trendOperationalLoad: 420 },
            { machineId: 'comp_row', machineName: 'Compound Row', demographicCohort: 'Healthcare / Clinical', averageSessionsToTrend: 9, averageWeeksToTrend: 4.5, baselineOperationalLoad: 120, trendOperationalLoad: 144 },
          ],
          machineEfficacy: [
            { machineId: 'lumbar_ext', machineName: 'Lumbar Extension', averageBaselineWeight: 80, averagePeakWeight: 140, averageTimeUnderLoad: 90, averageRepQuality: 4.5, percentIncreaseOperationalLoad: 75 },
            { machineId: 'leg_press', machineName: 'Leg Press', averageBaselineWeight: 220, averagePeakWeight: 360, averageTimeUnderLoad: 105, averageRepQuality: 4.2, percentIncreaseOperationalLoad: 63 },
            { machineId: 'comp_row', machineName: 'Compound Row', averageBaselineWeight: 100, averagePeakWeight: 165, averageTimeUnderLoad: 80, averageRepQuality: 4.0, percentIncreaseOperationalLoad: 65 },
            { machineId: 'chest_press', machineName: 'Chest Press', averageBaselineWeight: 90, averagePeakWeight: 125, averageTimeUnderLoad: 75, averageRepQuality: 3.8, percentIncreaseOperationalLoad: 38 },
            { machineId: 'hip_abd', machineName: 'Hip Abduction', averageBaselineWeight: 110, averagePeakWeight: 175, averageTimeUnderLoad: 85, averageRepQuality: 4.4, percentIncreaseOperationalLoad: 59 },
          ],
          retention: [
            { ageBracketLabel: '18-35', occupationCategory: 'Corporate & Tech', averageLifespanMonths: 14, averageSessionsCompleted: 56, cohortSize: 120 },
            { ageBracketLabel: '36-55', occupationCategory: 'Corporate & Tech', averageLifespanMonths: 42, averageSessionsCompleted: 168, cohortSize: 250 },
            { ageBracketLabel: '56+', occupationCategory: 'Corporate & Tech', averageLifespanMonths: 65, averageSessionsCompleted: 260, cohortSize: 180 },
            { ageBracketLabel: '18-35', occupationCategory: 'Manual Labor', averageLifespanMonths: 8, averageSessionsCompleted: 32, cohortSize: 45 },
            { ageBracketLabel: '36-55', occupationCategory: 'Manual Labor', averageLifespanMonths: 24, averageSessionsCompleted: 96, cohortSize: 90 },
            { ageBracketLabel: '56+', occupationCategory: 'Manual Labor', averageLifespanMonths: 35, averageSessionsCompleted: 140, cohortSize: 60 },
          ],
          strengthGainsByDemographic: [
            { segment: 'Occupation', label: 'Corporate & Tech', averagePercentGain: 84 },
            { segment: 'Occupation', label: 'Manual Labor', averagePercentGain: 42 },
            { segment: 'Occupation', label: 'Healthcare & Clinical', averagePercentGain: 68 },
            { segment: 'Occupation', label: 'First Responder', averagePercentGain: 55 },
            { segment: 'Age Group', label: '18-35', averagePercentGain: 78 },
            { segment: 'Age Group', label: '36-55', averagePercentGain: 62 },
            { segment: 'Age Group', label: '56+', averagePercentGain: 59 },
            { segment: 'Contraindications', label: 'None', averagePercentGain: 75 },
            { segment: 'Contraindications', label: 'Low Back Pain', averagePercentGain: 52 },
            { segment: 'Contraindications', label: 'Joint Replacement', averagePercentGain: 48 },
            { segment: 'Contraindications', label: 'Hypertension', averagePercentGain: 60 }
          ],
          strengthGainsByMuscleGroup: [
            { muscleGroup: 'Chest & Shoulders', averagePercentGain: 55 },
            { muscleGroup: 'Back & Core', averagePercentGain: 82 },
            { muscleGroup: 'Legs & Glutes', averagePercentGain: 71 },
            { muscleGroup: 'Arms & Grip', averagePercentGain: 46 }
          ],
          summary: {
            totalCohortClients: 1542,
            totalCohortSessions: 42100,
            averageAggregateIncrease: 62.5
          }
        };

        // Cache the mock result so it persists during demo
        const cachePayload: CachedInsights = {
          timestamp: Date.now(),
          data: mockFallback
        };
        sessionStorage.setItem(GLOBAL_INSIGHTS_CACHE_KEY, JSON.stringify(cachePayload));

        return mockFallback;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'aggregations/global_insights');
      return null;
    }
  }

  /**
   * Manually invalidate the cache (e.g., if a force-refresh is requested).
   */
  static invalidateCache(): void {
    sessionStorage.removeItem(GLOBAL_INSIGHTS_CACHE_KEY);
    console.debug('[InsightsService] Cache manually invalidated.');
  }
}
