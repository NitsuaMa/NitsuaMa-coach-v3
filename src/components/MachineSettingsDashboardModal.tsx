import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, X } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis } from "recharts";
import { Machine, ExerciseLog, WorkoutSession } from "../types";
import { parseSessionDate } from "../lib/utils";

interface Props {
  editingSettings: { machineId: string; settings: Record<string, string> } | null;
  setEditingSettings: (settings: { machineId: string; settings: Record<string, string> } | null) => void;
  machines: Machine[];
  exerciseLogs: ExerciseLog[];
  sessions: WorkoutSession[];
  isSaving: boolean;
  onSave: () => void;
}

export function MachineSettingsDashboardModal({
  editingSettings,
  setEditingSettings,
  machines,
  exerciseLogs,
  sessions,
  isSaving,
  onSave,
}: Props) {
  if (!editingSettings) return null;
  const mId = editingSettings.machineId;
  const targetMachine = machines.find((m) => m.id === mId);

  // Calculate PR
  const machineLogs = exerciseLogs.filter(
    (l) => l.machineId === mId && parseInt(l.reps || "0") > 0
  );
  const pr = machineLogs.reduce(
    (max, l) => Math.max(max, parseInt(l.weight || "0") || 0),
    0
  );

  // Calculate Trajectory
  const recentLogs = [...machineLogs]
    .sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime())
    .slice(0, 6);
  const lastLog = recentLogs[0];
  const previousLogs = recentLogs.slice(1, 6);
  const prevAvg =
    previousLogs.length > 0
      ? previousLogs.reduce((sum, l) => sum + (parseInt(l.weight || "0") || 0), 0) /
        previousLogs.length
      : 0;
  const percentChange =
    prevAvg > 0 && lastLog
      ? Math.round(((parseInt(lastLog.weight || "0") || 0) - prevAvg) / prevAvg * 100)
      : 0;
  const isPositive = percentChange >= 0;

  // Calculate Trend Data (last 10 sessions)
  const trendData = sessions
    .slice(0, 10)
    .reverse()
    .map((session) => {
      const log = exerciseLogs.find(
        (l) => l.machineId === mId && l.sessionId === session.id
      );
      const weight = parseInt(log?.weight || "0") || 0;
      const reps = parseInt(log?.reps || "0") || 0;
      return {
        sessionDate: new Date(parseSessionDate(session.date)).toLocaleDateString(
          "en-US",
          { month: "short", day: "2-digit" }
        ),
        weight: reps > 0 ? weight : null,
      };
    });

  return (
    <Dialog
      open={!!editingSettings}
      onOpenChange={(open) => !open && setEditingSettings(null)}
    >
      <DialogContent className="max-w-[800px] rounded-3xl border border-slate-700 shadow-[0_0_50px_rgba(0,0,0,0.5)] p-0 overflow-hidden bg-[#0A2E46] backdrop-blur-md">
        {/* Hero Header */}
        <div className="bg-slate-900 border-b border-slate-800 p-6 flex flex-col justify-between relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setEditingSettings(null)}
            className="absolute top-4 right-4 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold uppercase tracking-widest text-slate-400 mb-2">
              {targetMachine?.name}
            </h2>
            <div className="flex flex-wrap items-end gap-4">
              <div className="text-4xl sm:text-5xl font-black text-[#F06C22] leading-none tracking-tighter">
                {pr > 0 ? `${pr} LBS` : "---"}
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#F06C22]/50 ml-3 relative -top-3 sm:-top-4">
                  Personal Record
                </span>
              </div>
              {percentChange !== 0 && (
                <div
                  className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest mb-1.5 ${
                    isPositive
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-slate-800 text-slate-400 border border-slate-700"
                  }`}
                >
                  {isPositive ? "+" : ""}
                  {percentChange}% Trend
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Trend Visualization (Middle Section) */}
        <div className="p-6 bg-[#0A2E46] border-b border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400">
              Load Progression (Last 10 Sessions)
            </h3>
          </div>
          <div className="h-[160px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trendData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <XAxis
                  dataKey="sessionDate"
                  stroke="#475569"
                  tick={{ fill: "#475569", fontSize: 10, fontWeight: 700 }}
                  tickMargin={10}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #1e293b",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                  itemStyle={{ color: "#F06C22", fontWeight: 900 }}
                  labelStyle={{
                    color: "#94a3b8",
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: "4px",
                  }}
                  formatter={(value: any) => [`${value} lbs`, "Load"]}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#F06C22"
                  strokeWidth={3}
                  dot={{ fill: "#F06C22", strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: "#fff", stroke: "#F06C22" }}
                  connectNulls={true}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Machine Settings Editor */}
        <div className="p-6 bg-[#0A2E46]">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
            <Settings className="w-4 h-4" /> Machine Configuration
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {targetMachine?.settingOptions?.map((opt) => (
              <div key={opt} className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                  {opt}
                </label>
                <Input
                  value={editingSettings.settings[opt] || ""}
                  onChange={(e) =>
                    setEditingSettings({
                      ...editingSettings,
                      settings: {
                        ...editingSettings.settings,
                        [opt]: e.target.value,
                      },
                    })
                  }
                  placeholder="--"
                  className="h-12 rounded-xl bg-slate-800 border border-slate-700 focus:border-[#F06C22] focus:ring-[#F06C22] text-lg font-black text-white px-4 tabular-nums transition-all shadow-sm"
                />
              </div>
            ))}
          </div>

          <Button
            disabled={isSaving}
            onClick={onSave}
            className="w-full h-14 rounded-xl bg-[#F06C22] hover:bg-[#F06C22]/90 text-white font-black uppercase tracking-widest text-sm shadow-lg active:scale-[0.98] transition-all"
          >
            {isSaving ? "Saving..." : "Save Machine Settings"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
