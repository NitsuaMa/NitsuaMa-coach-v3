import React, { useState } from 'react';
import { Filter, Loader2, AlertCircle, BarChart3, Activity, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ActivityLevel } from '../data/occupational-matrix';
import { InsightsFilterState } from '../data/insights-logic';
import { DemographicRetentionChart } from './DemographicRetentionChart';
import { MachineEfficacyChart } from './MachineEfficacyChart';
import { TimeToTrendChart } from './TimeToTrendChart';
import { useInsightsData } from '../hooks/useInsightsData';
import { MaxStrengthLogo } from './MaxStrengthLogo';

export function InsightsDashboardView(props: any) {
  const [filters, setFilters] = useState<InsightsFilterState>({
    startDate: null,
    endDate: null,
    ageBrackets: [],
    genders: [],
    physicalStressProfiles: []
  });

  const { data, loading, error } = useInsightsData(filters);

  return (
    <div className="flex flex-col w-full h-full bg-[#0A2E46] overflow-x-hidden p-6 md:p-8 space-y-8 safe-area-pt pb-24">
      {/* Header & Filter Hub */}
      <div className="shrink-0 flex flex-col gap-6">
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white leading-none">
            Clinical Insights
          </h1>
          <p className="text-sm font-bold uppercase tracking-widest text-[#38BDF8] mt-2">
            Demographic & Efficacy Analytics
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-700 p-4 rounded-2xl shadow-xl flex flex-col md:flex-row gap-4 items-center w-full">
          <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-widest text-xs shrink-0 mr-2">
            <Filter className="w-4 h-4" />
            Filters
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
            <select 
              defaultValue="30days"
              className="bg-slate-800 border border-slate-700 text-white font-bold h-12 rounded-xl px-4 appearance-none outline-none focus:ring-2 focus:ring-[#38BDF8] w-full"
            >
              <option value="30days">Last 30 Days</option>
              <option value="90days">Last 90 Days</option>
              <option value="ytd">Year to Date</option>
              <option value="all">All Time</option>
            </select>

            <select 
              defaultValue="all"
              onChange={(e) => setFilters(prev => ({
                ...prev,
                ageBrackets: e.target.value === 'all' ? [] : [{ min: parseInt(e.target.value.split('-')[0]) || 56, max: parseInt(e.target.value.split('-')[1]) || 120, label: e.target.value }]
              }))}
              className="bg-slate-800 border border-slate-700 text-white font-bold h-12 rounded-xl px-4 appearance-none outline-none focus:ring-2 focus:ring-[#38BDF8] w-full"
            >
              <option value="all">All Ages</option>
              <option value="18-35">18 - 35</option>
              <option value="36-55">36 - 55</option>
              <option value="56+">56+</option>
            </select>

            <select 
              defaultValue="all"
              onChange={(e) => setFilters(prev => ({
                ...prev,
                genders: e.target.value === 'all' ? [] : [e.target.value as any]
              }))}
              className="bg-slate-800 border border-slate-700 text-white font-bold h-12 rounded-xl px-4 appearance-none outline-none focus:ring-2 focus:ring-[#38BDF8] w-full"
            >
              <option value="all">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>

            <select 
              defaultValue="all" 
              onChange={(e) => setFilters(prev => ({ 
                ...prev, 
                activityLevels: e.target.value === 'all' ? [] : [e.target.value as ActivityLevel] 
              }))}
              className="bg-slate-800 border border-slate-700 text-white font-bold h-12 rounded-xl px-4 appearance-none outline-none focus:ring-2 focus:ring-[#38BDF8] w-full"
            >
              <option value="all">All Activity Levels</option>
              <option value="Highly Sedentary">Highly Sedentary</option>
              <option value="Sedentary">Sedentary</option>
              <option value="Moderate / Mixed">Moderate / Mixed</option>
              <option value="Active">Active</option>
            </select>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex-1 grid grid-cols-1 gap-8 content-start pb-12 animate-pulse mb-8">
          
          {/* Card 1 Skeleton */}
          <Card className="bg-[#F8F9FA]/60 border-slate-200/30 rounded-[32px] shadow-lg flex flex-col h-[400px]">
            <CardHeader className="border-b border-slate-200/50 p-6 shrink-0 flex flex-row items-center justify-between">
              <div>
                <div className="h-6 bg-slate-300 rounded w-64 mb-2"></div>
                <div className="h-4 bg-slate-200 rounded w-48"></div>
              </div>
              <div className="w-8 h-8 animate-spin">
                <MaxStrengthLogo />
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-6 flex flex-col items-center justify-center text-center">
              <div className="flex flex-col items-center opacity-50">
                <BarChart3 className="w-16 h-16 text-slate-400 mb-4" />
                <p className="text-sm font-black uppercase tracking-widest text-slate-500">Compiling Demographics...</p>
                <p className="text-xs font-semibold text-slate-400 mt-2">Retrieving Phase 4 Visualizations</p>
              </div>
            </CardContent>
          </Card>

          {/* Card 2 Skeleton */}
          <Card className="bg-[#F8F9FA]/60 border-slate-200/30 rounded-[32px] shadow-lg flex flex-col h-[400px]">
            <CardHeader className="border-b border-slate-200/50 p-6 shrink-0 flex flex-row items-center justify-between">
              <div>
                <div className="h-6 bg-slate-300 rounded w-72 mb-2"></div>
                <div className="h-4 bg-slate-200 rounded w-56"></div>
              </div>
               <div className="w-8 h-8 animate-spin">
                <MaxStrengthLogo />
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-6 flex flex-col items-center justify-center text-center">
              <div className="flex flex-col items-center opacity-50">
                <Activity className="w-16 h-16 text-slate-400 mb-4" />
                <p className="text-sm font-black uppercase tracking-widest text-slate-500">Analyzing Machine Data...</p>
                <p className="text-xs font-semibold text-slate-400 mt-2">Retrieving Phase 4 Visualizations</p>
              </div>
            </CardContent>
          </Card>

          {/* Card 3 Skeleton */}
          <Card className="bg-[#F8F9FA]/60 border-slate-200/30 rounded-[32px] shadow-lg flex flex-col h-[400px]">
            <CardHeader className="border-b border-slate-200/50 p-6 shrink-0 flex flex-row items-center justify-between">
              <div>
                <div className="h-6 bg-slate-300 rounded w-48 mb-2"></div>
                <div className="h-4 bg-slate-200 rounded w-64"></div>
              </div>
               <div className="w-8 h-8 animate-spin">
                <MaxStrengthLogo />
              </div>
            </CardHeader>
             <CardContent className="flex-1 p-6 flex flex-col items-center justify-center text-center">
              <div className="flex flex-col items-center opacity-50">
                <TrendingUp className="w-16 h-16 text-slate-400 mb-4" />
                <p className="text-sm font-black uppercase tracking-widest text-slate-500">Calculating Trends...</p>
                <p className="text-xs font-semibold text-slate-400 mt-2">Retrieving Phase 4 Visualizations</p>
              </div>
            </CardContent>
          </Card>

        </div>
      )}

      {error && (
        <div className="flex-1 flex flex-col items-center justify-center text-red-400">
           <AlertCircle className="w-12 h-12 mb-4 text-red-500" />
           <p className="text-sm font-black uppercase tracking-widest">Failed to load insights</p>
           <p className="text-xs font-bold text-slate-500 mt-2">{error.message}</p>
        </div>
      )}

      {/* Chart Grid */}
      {!loading && !error && (
        <div className="flex-1 grid grid-cols-1 gap-8 content-start pb-12">
          
          {/* Card 1 */}
          <Card className="bg-[#F8F9FA] border-slate-200/50 rounded-[32px] shadow-lg flex flex-col h-[400px]">
            <CardHeader className="border-b border-slate-200 p-6 shrink-0">
              <CardTitle className="text-xl font-black uppercase text-slate-800 tracking-tight">
                Demographic Retention Analysis
              </CardTitle>
              <CardDescription className="text-xs font-bold uppercase tracking-widest text-[#F06C22]">
                LTV & Churn by Age / Occupation
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-6 h-[300px]">
              <DemographicRetentionChart data={data?.retention} />
            </CardContent>
          </Card>

          {/* Card 2 */}
          <Card className="bg-[#F8F9FA] border-slate-200/50 rounded-[32px] shadow-lg flex flex-col h-[400px]">
            <CardHeader className="border-b border-slate-200 p-6 shrink-0">
              <CardTitle className="text-xl font-black uppercase text-slate-800 tracking-tight">
                Machine Efficacy by Occupational Stress
              </CardTitle>
              <CardDescription className="text-xs font-bold uppercase tracking-widest text-[#38BDF8]">
                Load Progression Across Hardware
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-6 h-[300px]">
              <MachineEfficacyChart data={data?.machineEfficacy} />
            </CardContent>
          </Card>

          {/* Card 3 */}
          <Card className="bg-[#F8F9FA] border-slate-200/50 rounded-[32px] shadow-lg flex flex-col h-[400px]">
            <CardHeader className="border-b border-slate-200 p-6 shrink-0">
              <CardTitle className="text-xl font-black uppercase text-slate-800 tracking-tight">
                Time-to-Trend Data
              </CardTitle>
              <CardDescription className="text-xs font-bold uppercase tracking-widest text-[#10B981]">
                Sessions Required for 20% Load Increase
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-6 h-[300px]">
              <TimeToTrendChart data={data?.timeToTrend} />
            </CardContent>
          </Card>

        </div>
      )}
    </div>
  );
}
