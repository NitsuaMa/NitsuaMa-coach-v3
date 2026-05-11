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
        console.warn('[InsightsService] No global insights document found.');
        return null;
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
