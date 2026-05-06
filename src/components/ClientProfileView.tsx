import React, { useState, useEffect } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Plus,
  Trash2,
  Save,
  Clock,
  Dumbbell,
  TrendingUp,
  AlertCircle,
  Play,
  History,
  Scan,
  Maximize2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MachineInsightsModal } from "./MachineInsightsModal";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROUTINE_TEMPLATES, RoutineTemplateType } from "../constants";
import { ClientFocusDashboard } from "./ClientFocusDashboard";
import {
  Client,
  Machine,
  WorkoutSession,
  ExerciseLog,
  Routine,
  View,
  ClientMachineSetting,
  TrainerFocus,
  Trainer,
  ScheduleEntry,
  ProgressReport,
  FocusRecord,
} from "../types";
import { OperationType, handleFirestoreError } from "../lib/firestore-errors";
import { WorkoutChartGrid } from "./WorkoutChartGrid";
import { ClientHistoryCalendar } from "./ClientHistoryCalendar";
import { OccupationSelect } from "./OccupationSelect";
import { cn, parseSessionDate } from "../lib/utils";

export function ClientProfileView({
  clientId,
  clients,
  machines,
  authTrainer,
  trainers,
  onDelete,
  onSelectReport,
  setView,
  hasQuotaError,
  user,
}: {
  clientId: string | null;
  clients: Client[];
  machines: Machine[];
  authTrainer?: Trainer | null;
  trainers: Trainer[];
  onDelete: (id: string) => void;
  onSelectReport: (id: string) => void;
  setView: (v: View) => void;
  hasQuotaError?: boolean;
  user?: any;
}) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [allLogs, setAllLogs] = useState<ExerciseLog[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [clientSettings, setClientSettings] = useState<
    Record<string, ClientMachineSetting>
  >({});
  const [trainerFocuses, setTrainerFocuses] = useState<TrainerFocus[]>([]);
  const [progressReports, setProgressReports] = useState<ProgressReport[]>([]);
  const [scheduledSessions, setScheduledSessions] = useState<ScheduleEntry[]>(
    [],
  );
  const [isEditingFocus, setIsEditingFocus] = useState(false);
  const [isEditingSessionCount, setIsEditingSessionCount] = useState(false);
  const [sessionCountInput, setSessionCountInput] = useState("");
  const [focusForm, setFocusForm] = useState<Partial<TrainerFocus>>({
    category: "Path",
    notes: "",
  });
  const [selectedTimingSessionId, setSelectedTimingSessionId] = useState<
    string | null
  >(null);
  const [isSavingFocus, setIsSavingFocus] = useState(false);
  const [isEditingRoutine, setIsEditingRoutine] = useState<string | null>(null);
  const [routineEditData, setRoutineEditData] = useState<{
    name: string;
    machineIds: string[];
  }>({ name: "", machineIds: [] });
  const [highlightRoutine, setHighlightRoutine] = useState<"A" | "B" | null>(
    null,
  );
  const [historyPage, setHistoryPage] = useState(0);
  const [showFullChart, setShowFullChart] = useState(false);
  const [sessionLimit, setSessionLimit] = useState(10);
  const [activeTab, setActiveTab] = useState("overview");
  const [infoForm, setInfoForm] = useState<Partial<Client>>({});
  const [newEventForm, setNewEventForm] = useState<{
    date: string;
    title: string;
    type: any;
    notes: string;
  }>({
    date: new Date().toISOString().split("T")[0],
    title: "",
    type: "Other",
    notes: "",
  });
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [stagedMachineIds, setStagedMachineIds] = useState<
    Record<string, string[]>
  >({});
  const [isSavingRoutine, setIsSavingRoutine] = useState<
    Record<string, boolean>
  >({});
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedInsightMachine, setSelectedInsightMachine] =
    useState<Machine | null>(null);
  const [showFullMatrix, setShowFullMatrix] = useState(false);
  const [matrixRoutineFilter, setMatrixRoutineFilter] = useState<string>("all");
  const SESSIONS_PER_PAGE = 3;

  const client = clients.find((c) => c.id === clientId);

  useEffect(() => {
    if (client) {
      setInfoForm({
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email || "",
        phone: client.phone || "",
        gender: client.gender || "Male",
        height: client.height || "",
        weight: client.weight || "",
        age: client.age ?? null,
        occupation: client.occupation || "",
        isRetired: client.isRetired ?? false,
        clinicalProfile: client.clinicalProfile || [],
        clinicalNotes: client.clinicalNotes || "",
        activityLevel: client.activityLevel || "Moderate",
        trainingPedigree: client.trainingPedigree || "Novice",
        recoveryMetric: client.recoveryMetric || "Average",
        emergencyContactName: client.emergencyContactName || "",
        emergencyContactPhone: client.emergencyContactPhone || "",
        globalNotes: client.globalNotes || "",
        isActive: client.isActive ?? true,
        isRoutineBActive: client.isRoutineBActive ?? false,
        consultationCompleted: client.consultationCompleted ?? false,
        packageTier: client.packageTier || "None",
        remainingSessions: client.remainingSessions ?? 0,
      });
    }
  }, [client]);

  const handleSaveInfo = async () => {
    if (!clientId) return;
    setIsSavingInfo(true);
    try {
      const sanitizedData = { ...infoForm };

      // Ensure age is a number or null, not an empty string
      if (sanitizedData.age === "" || sanitizedData.age === undefined) {
        delete sanitizedData.age;
      } else {
        const parsed = parseInt(sanitizedData.age as any, 10);
        sanitizedData.age = isNaN(parsed) ? null : parsed;
      }

      // Ensure remainingSessions is a number
      if (sanitizedData.remainingSessions !== undefined) {
        const parsed = parseInt(sanitizedData.remainingSessions as any, 10);
        sanitizedData.remainingSessions = isNaN(parsed) ? 0 : parsed;
      }

      // Cleanup other potentially empty strings to null or delete them if rules prefer
      Object.keys(sanitizedData).forEach((key) => {
        if ((sanitizedData as any)[key] === undefined) {
          delete (sanitizedData as any)[key];
        }
      });

      await updateDoc(doc(db, "clients", clientId), {
        ...sanitizedData,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `clients/${clientId}`);
    } finally {
      setIsSavingInfo(false);
    }
  };

  const handleAddEvent = async () => {
    if (!clientId || !client || !newEventForm.title || !newEventForm.date)
      return;
    setIsSavingEvent(true);
    try {
      let priority: "High" | "Medium" | "Low" = "Low";
      if (
        newEventForm.type === "Progress Report" ||
        newEventForm.type === "InBody Scan"
      )
        priority = "High";
      else if (newEventForm.type === "Routine Change") priority = "Medium";

      const newEvent = {
        id: Math.random().toString(36).substring(2, 9),
        ...newEventForm,
        priority,
        createdAt: new Date().toISOString(),
      };

      const updatedEvents = [...(client.events || []), newEvent];
      await updateDoc(doc(db, "clients", clientId), {
        events: updatedEvents,
        updatedAt: serverTimestamp(),
      });
      setNewEventForm({
        date: new Date().toISOString().split("T")[0],
        title: "",
        type: "Other",
        notes: "",
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `clients/${clientId}`);
    } finally {
      setIsSavingEvent(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!clientId || !client?.events) return;
    try {
      const updatedEvents = client.events.filter((e) => e.id !== eventId);
      await updateDoc(doc(db, "clients", clientId), {
        events: updatedEvents,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `clients/${clientId}`);
    }
  };

  const handleSaveSessionCount = async () => {
    if (!clientId) return;
    const num = parseInt(sessionCountInput, 10);
    if (isNaN(num)) return;

    try {
      await updateDoc(doc(db, "clients", clientId), {
        sessionCount: num,
        updatedAt: serverTimestamp(),
      });
      setIsEditingSessionCount(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `clients/${clientId}`);
    }
  };

  const handleToggleRoutineB = async (checked: boolean) => {
    if (!clientId) return;
    try {
      await updateDoc(doc(db, "clients", clientId), {
        isRoutineBActive: checked,
        updatedAt: serverTimestamp(),
      });
      setInfoForm((prev) => ({ ...prev, isRoutineBActive: checked }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `clients/${clientId}`);
    }
  };

  const toggleMachineInRoutine = (routineName: string, machineId: string) => {
    const current = stagedMachineIds[routineName] || [];
    const next = current.includes(machineId)
      ? current.filter((id) => id !== machineId)
      : [...current, machineId];

    setStagedMachineIds((prev) => ({ ...prev, [routineName]: next }));
  };

  const handleSaveRoutineConfig = async (routineName: string) => {
    if (!clientId) return;
    const machineIds = stagedMachineIds[routineName] || [];

    setIsSavingRoutine((prev) => ({ ...prev, [routineName]: true }));
    try {
      const existing = routines.find((r) => r.name === routineName);
      if (existing) {
        await updateDoc(doc(db, "routines", existing.id!), {
          machineIds,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "routines"), {
          clientId,
          name: routineName,
          machineIds,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "routines");
    } finally {
      setIsSavingRoutine((prev) => ({ ...prev, [routineName]: false }));
    }
  };

  const handleApplyTemplate = (
    templateType: RoutineTemplateType,
    routineName: string,
  ) => {
    if (!clientId) return;

    const templateNames = ROUTINE_TEMPLATES[templateType];
    const machineIds = templateNames
      .map(
        (name) =>
          machines.find((m) => m.name === name || m.fullName === name)?.id,
      )
      .filter((id): id is string => !!id);

    setStagedMachineIds((prev) => ({ ...prev, [routineName]: machineIds }));

    if (routineName?.includes("Routine B")) {
      handleToggleRoutineB(true);
    }
  };

  useEffect(() => {
    if (!clientId || hasQuotaError) return;

    // Only fetch primary overview data or routines data if on those tabs
    const shouldFetch =
      activeTab === "overview" ||
      activeTab === "routines" ||
      activeTab === "routines_setup";

    const fetchData = async () => {
      try {
        // Fetch Routines
        const routinesQuery = query(
          collection(db, "routines"),
          where("clientId", "==", clientId),
        );
        const routineSnap = await getDocs(routinesQuery);
        const routinesData = routineSnap.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as Routine,
        );
        setRoutines(routinesData);

        // Initialize staged IDs
        const initialStaged: Record<string, string[]> = {};
        routinesData.forEach((r) => {
          initialStaged[r.name] = r.machineIds;
        });
        setStagedMachineIds((prev) => ({ ...initialStaged, ...prev }));

        // Only fetch sessions/logs if needed for charts or history
        if (
          activeTab === "overview" ||
          activeTab === "history" ||
          activeTab === "timing"
        ) {
          // Fetch Recent Sessions
          const sessionsQuery = query(
            collection(db, "sessions"),
            where("clientId", "==", clientId),
            orderBy("date", "desc"),
            limit(activeTab === "overview" ? 5 : sessionLimit),
          );
          const sessionSnap = await getDocs(sessionsQuery);
          const sessionsData = sessionSnap.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as WorkoutSession,
          );
          // Apply robust client-side sort to ensure chronological integrity
          sessionsData.sort(
            (a, b) => parseSessionDate(b.date) - parseSessionDate(a.date),
          );
          setSessions(sessionsData);

          // Fetch exact logs for the fetched sessions
          let allFetchedLogs: ExerciseLog[] = [];

          if (sessionsData.length > 0) {
            const sessionIds = sessionsData.map((s) => s.id!).filter(Boolean);
            const chunks = [];
            for (let i = 0; i < sessionIds.length; i += 10) {
              chunks.push(sessionIds.slice(i, i + 10));
            }

            for (const chunk of chunks) {
              const qs = query(
                collection(db, "exerciseLogs"),
                where("sessionId", "in", chunk),
              );
              const snap = await getDocs(qs);
              allFetchedLogs = [
                ...allFetchedLogs,
                ...snap.docs.map(
                  (doc) => ({ id: doc.id, ...doc.data() }) as ExerciseLog,
                ),
              ];
            }
          }
          setAllLogs(allFetchedLogs);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, "multiple");
      }
    };

    fetchData();
  }, [clientId, sessionLimit, activeTab, hasQuotaError]);

  useEffect(() => {
    if (!clientId) return;

    const settingsQ = query(
      collection(db, "clientMachineSettings"),
      where("clientId", "==", clientId),
    );

    const unsubscribe = onSnapshot(
      settingsQ,
      (snap) => {
        const settingsMap: Record<string, ClientMachineSetting> = {};
        snap.docs.forEach((doc) => {
          const data = { id: doc.id, ...doc.data() } as ClientMachineSetting;
          settingsMap[data.machineId] = data;
        });
        setClientSettings(settingsMap);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "clientMachineSettings");
      },
    );

    return () => unsubscribe();
  }, [clientId]);

  useEffect(() => {
    if (!clientId || hasQuotaError) return;
    if (activeTab !== "overview" && activeTab !== "focus") return;

    const fetchFocuses = async () => {
      try {
        const focusQ = query(
          collection(db, "trainerFocuses"),
          where("clientId", "==", clientId),
          orderBy("updatedAt", "desc"),
        );
        const snap = await getDocs(focusQ);
        setTrainerFocuses(
          snap.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as TrainerFocus,
          ),
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, "trainerFocuses");
      }
    };

    fetchFocuses();
  }, [clientId]);

  useEffect(() => {
    if (!clientId || hasQuotaError || !user) return;
    if (activeTab !== "reports") return;

    const fetchReports = async () => {
      try {
        const q = query(
          collection(db, "progressReports"),
          where("clientId", "==", clientId),
          orderBy("createdAt", "desc"),
          limit(50),
        );
        const snap = await getDocs(q);
        setProgressReports(
          snap.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as ProgressReport,
          ),
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, "progressReports");
      }
    };

    fetchReports();
  }, [clientId]);

  useEffect(() => {
    if (!clientId || !user) return;
    const q = query(
      collection(db, "schedules"),
      where("clientId", "==", clientId),
      where("startTime", ">=", Timestamp.now()),
      orderBy("startTime", "asc"),
      limit(2),
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setScheduledSessions(
          snap.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as ScheduleEntry,
          ),
        );
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "schedules");
      },
    );
    return () => unsubscribe();
  }, [clientId]);

  useEffect(() => {
    const myFocus = trainerFocuses.find((f) => f.trainerId === authTrainer?.id);
    if (myFocus) {
      setFocusForm({
        category: myFocus.category,
        notes: myFocus.notes,
      });
    }
  }, [trainerFocuses, authTrainer]);

  const handleSaveFocus = async () => {
    if (!clientId || !authTrainer) return;
    setIsSavingFocus(true);
    try {
      const myFocus = trainerFocuses.find(
        (f) => f.trainerId === authTrainer.id,
      );
      const focusData = {
        clientId,
        trainerId: authTrainer.id,
        trainerName: authTrainer.fullName,
        category: focusForm.category,
        notes: focusForm.notes,
        updatedAt: serverTimestamp(),
      };

      if (myFocus) {
        await updateDoc(doc(db, "trainerFocuses", myFocus.id!), focusData);
      } else {
        await addDoc(collection(db, "trainerFocuses"), focusData);
      }
      setIsEditingFocus(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "trainerFocuses");
    } finally {
      setIsSavingFocus(false);
    }
  };

  const handleSaveRoutine = async () => {
    if (!clientId || !isEditingRoutine) return;

    const original = routines.find((r) => r.id === isEditingRoutine);
    if (!original) return;

    try {
      // 1. Update existing routine
      await updateDoc(doc(db, "routines", isEditingRoutine), {
        name: routineEditData.name,
        machineIds: routineEditData.machineIds,
        updatedAt: serverTimestamp(),
      });

      // 2. Log adjustment in backend for history
      await addDoc(collection(db, "routineAdjustments"), {
        routineId: isEditingRoutine,
        clientId,
        previousMachineIds: original.machineIds,
        newMachineIds: routineEditData.machineIds,
        trainerId: authTrainer?.id || "unknown",
        createdAt: serverTimestamp(),
      });

      setIsEditingRoutine(null);
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `routines/${isEditingRoutine}`,
      );
    }
  };

  const startEditRoutine = (routine: Routine) => {
    setIsEditingRoutine(routine.id!);
    setRoutineEditData({
      name: routine.name,
      machineIds: [...routine.machineIds],
    });
  };

  if (!client)
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground opacity-20" />
        <p className="text-muted-foreground font-medium">
          Select a client to view their profile.
        </p>
        <Button onClick={() => setView("clients")}>Back to Clients</Button>
      </div>
    );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[1400px] mx-auto space-y-2 pb-8 px-2 sm:px-4"
    >
      {/* Alerts / Notifications */}
      {(() => {
        if (progressReports.length === 0) {
          // Only show "Report Required" if client is older than 3 months
          const clientCreatedAt =
            client.createdAt?.toDate?.() ||
            (client.createdAt ? new Date(client.createdAt) : new Date());
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

          if (clientCreatedAt > threeMonthsAgo) {
            return null;
          }

          return (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
            >
              <div className="bg-red-500/10 border-2 border-red-500/20 rounded-3xl p-4 flex items-center gap-4 text-red-600">
                <AlertCircle className="w-6 h-6 flex-shrink-0" />
                <div>
                  <p className="text-xs font-black uppercase tracking-tight">
                    Report Required
                  </p>
                  <p className="text-[10px] font-bold opacity-80">
                    This client has no progress report on file. Please perform
                    an evaluation.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  className="ml-auto text-[10px] font-black uppercase hover:bg-red-500/10"
                  onClick={() => setView("progress-report")}
                >
                  Start Now
                </Button>
              </div>
            </motion.div>
          );
        }

        const lastDate = new Date(progressReports[0].date + "T12:00:00");
        const nextDueDate = new Date(lastDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + 3);

        const today = new Date();
        const diffTime = nextDueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 21) {
          const isOverdue = diffDays < 0;
          return (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
            >
              <div
                className={`${isOverdue ? "bg-red-500/10 border-red-200 text-red-600" : "bg-amber-500/10 border-amber-200 text-amber-600"} border-2 rounded-3xl p-4 flex items-center gap-4`}
              >
                <AlertCircle className="w-6 h-6 flex-shrink-0" />
                <div>
                  <p className="text-xs font-black uppercase tracking-tight">
                    Report Due {isOverdue ? "Yesterday" : `Soon`}
                  </p>
                  <p className="text-[10px] font-bold opacity-80">
                    {isOverdue
                      ? `The 3-month progress report was due on ${nextDueDate.toLocaleDateString()}.`
                      : `The next progress report is due on ${nextDueDate.toLocaleDateString()} (in ${diffDays} days).`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  className={`ml-auto text-[10px] font-black uppercase ${isOverdue ? "hover:bg-red-500/10" : "hover:bg-amber-500/10"}`}
                  onClick={() => setView("progress-report")}
                >
                  Schedule Report
                </Button>
              </div>
            </motion.div>
          );
        }
        return null;
      })()}

      {/* Compact Header */}
      <div className="bg-gradient-to-br from-[#115E8D] to-slate-900 rounded-[16px] px-3 sm:px-4 py-3 mb-2 shadow-md relative overflow-hidden text-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 sm:gap-4 z-10 shrink-[2] min-w-0">
          <Button
            onClick={() => setView("clients")}
            variant="ghost"
            size="icon"
            className="shrink-0 text-white/70 hover:text-white hover:bg-white/10 -ml-1 sm:-ml-2 h-8 w-8 sm:h-10 sm:w-10 rounded-full"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </Button>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/20 hidden sm:flex">
            <User className="w-5 h-5 text-white/50" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="text-lg sm:text-2xl font-black uppercase tracking-tighter leading-none m-0 truncate">
                {client.firstName} {client.lastName}
              </h2>
              <div className="flex items-center gap-1 group">
                <Badge
                  variant="outline"
                  className="bg-[#38BDF8]/10 text-[#38BDF8] border-[#38BDF8]/30 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest shadow-[0_0_10px_rgba(56,189,248,0.2)]"
                >
                  Session #{client.sessionCount ?? 0}
                </Badge>
                <button
                  onClick={() => {
                    setSessionCountInput(String(client.sessionCount ?? 0));
                    setIsEditingSessionCount(true);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded-full"
                >
                  <Edit3 className="w-3 h-3 text-[#38BDF8]" />
                </button>
              </div>

              {/* Balance Badge */}
              <div className="flex items-center gap-1">
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest shadow-[0_0_10px_rgba(52,211,153,0.2)]"
                >
                  {client.remainingSessions ?? 0} Left
                </Badge>
              </div>
            </div>

            {/* Flair Row */}
            <div className="flex flex-wrap gap-2 mt-2 mb-2 items-center group/flair">
              {true && (
                <div
                  className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded border ${
                    client.packageTier === "6-Month"
                      ? "bg-[#38BDF8]/10 text-[#38BDF8] border-[#38BDF8]/50 shadow-[0_0_15px_rgba(56,189,248,0.15)]"
                      : client.packageTier === "12-Month"
                        ? "bg-[#F06C22]/20 text-[#F06C22] border-[#F06C22]/50 shadow-[0_0_10px_rgba(240,108,34,0.3)]"
                        : client.packageTier === "18-Month"
                          ? "bg-gray-400/20 text-gray-200 border-gray-400/60 shadow-[0_0_15px_rgba(156,163,175,0.4)]"
                          : "bg-slate-700/20 text-slate-400 border-slate-700/50" +
                            ""
                  }`}
                >
                  {client.packageTier === "18-Month"
                    ? "18-Month VIP"
                    : client.packageTier === "12-Month"
                      ? "12-Month Tier"
                      : client.packageTier === "6-Month"
                        ? "6-Month Tier"
                        : "Prospect"}
                </div>
              )}
              {client.occupation && (
                <div className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded border bg-amber-500/10 text-amber-500 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                  {client.occupation}
                </div>
              )}
              {client.isRetired && (
                <div className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded border bg-purple-500/10 text-purple-400 border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                  RETIRED
                </div>
              )}
              {false ? (
                <button
                  onClick={() => setActiveTab("details")}
                  className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-white transition-colors flex items-center gap-1"
                >
                  + Add Tier
                </button>
              ) : (
                <button
                  onClick={() => setActiveTab("details")}
                  className="opacity-0 group-hover/flair:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded-full"
                >
                  <Edit3 className="w-3 h-3 text-slate-400" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-white/80">
              <div className="flex items-center gap-1 bg-white/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded border border-white/5 whitespace-nowrap">
                <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                <span>
                  LAST:{" "}
                  <span className="text-white">
                    {sessions[0]?.date
                      ? new Date(
                          sessions[0].date + "T12:00:00",
                        ).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "NONE"}
                  </span>
                </span>
              </div>
              {(() => {
                if (!scheduledSessions[0]) {
                  return (
                    <div className="flex items-center gap-1 bg-white/5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-white/40 border border-white/10 whitespace-nowrap">
                      <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      <span>NEXT: UNSCHEDULED</span>
                    </div>
                  );
                }

                const firstSessionDate =
                  scheduledSessions[0].startTime.toDate();
                const today = new Date();
                const isFirstSessionToday =
                  firstSessionDate.getDate() === today.getDate() &&
                  firstSessionDate.getMonth() === today.getMonth() &&
                  firstSessionDate.getFullYear() === today.getFullYear();

                if (isFirstSessionToday) {
                  const timeStr = firstSessionDate.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  });
                  let nextStr = "";
                  if (scheduledSessions[1]) {
                    const nextDate = scheduledSessions[1].startTime.toDate();
                    nextStr = ` | Next: ${nextDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`;
                  }
                  return (
                    <div className="flex items-center gap-1 bg-[#F06C22]/20 text-[#F06C22] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded border border-[#F06C22]/30 shadow-[0_0_10px_rgba(240,108,34,0.3)] whitespace-nowrap">
                      <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      <span>
                        Today @ {timeStr}{" "}
                        <span className="font-black text-white">{nextStr}</span>
                      </span>
                    </div>
                  );
                }

                return (
                  <div className="flex items-center gap-1 bg-[#F06C22]/20 text-[#F06C22] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded border border-[#F06C22]/30 shadow-[0_0_10px_rgba(240,108,34,0.3)] whitespace-nowrap">
                    <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    <span>
                      NEXT:{" "}
                      <span className="font-black text-white">
                        {firstSessionDate.toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 z-10 shrink-0 ml-auto">
          <Button
            onClick={() => setView("workouts")}
            className="bg-[#F06C22] hover:bg-[#F06C22]/90 text-white rounded-lg font-black uppercase text-xs sm:text-sm tracking-widest h-9 sm:h-10 px-4 sm:px-6 shadow-[0_0_15px_rgba(240,108,34,0.5)] border-none shrink-0"
          >
            START SESSION
          </Button>
        </div>

        <div className="absolute -right-20 -top-20 opacity-[0.03] pointer-events-none">
          <Dumbbell className="w-[300px] h-[300px]" />
        </div>
      </div>

      <Tabs
        defaultValue="overview"
        className="w-full flex-1 flex flex-col min-h-0"
        onValueChange={setActiveTab}
      >
        <div className="mb-2">
          <TabsList className="bg-transparent p-0 flex flex-wrap gap-1 w-full h-auto">
            <TabsTrigger
              value="overview"
              className="flex-1 min-w-[80px] rounded-full border border-slate-200 h-[26px] px-3 font-black uppercase text-[9px] tracking-widest text-[#68717A] bg-transparent data-[state=active]:border-transparent data-[state=active]:bg-[#115E8D] data-[state=active]:text-white transition-all data-[state=active]:shadow-sm"
            >
              Matrix
            </TabsTrigger>
            <TabsTrigger
              value="routines"
              className="flex-1 min-w-[80px] rounded-full border border-slate-200 h-[26px] px-3 font-black uppercase text-[9px] tracking-widest text-[#68717A] bg-transparent data-[state=active]:border-transparent data-[state=active]:bg-[#115E8D] data-[state=active]:text-white transition-all data-[state=active]:shadow-sm"
            >
              Routines
            </TabsTrigger>
            <TabsTrigger
              value="focus"
              className="flex-1 min-w-[80px] rounded-full border border-slate-200 h-[26px] px-3 font-black uppercase text-[9px] tracking-widest text-[#68717A] bg-transparent data-[state=active]:border-transparent data-[state=active]:bg-[#115E8D] data-[state=active]:text-white transition-all data-[state=active]:shadow-sm"
            >
              Focus
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="flex-1 min-w-[80px] rounded-full border border-slate-200 h-[26px] px-3 font-black uppercase text-[9px] tracking-widest text-[#68717A] bg-transparent data-[state=active]:border-transparent data-[state=active]:bg-[#115E8D] data-[state=active]:text-white transition-all data-[state=active]:shadow-sm"
            >
              History
            </TabsTrigger>
            <TabsTrigger
              value="reports"
              className="flex-1 min-w-[80px] rounded-full border border-slate-200 h-[26px] px-3 font-black uppercase text-[9px] tracking-widest text-[#68717A] bg-transparent data-[state=active]:border-transparent data-[state=active]:bg-[#115E8D] data-[state=active]:text-white transition-all data-[state=active]:shadow-sm"
            >
              Reports
            </TabsTrigger>
            <TabsTrigger
              value="timing"
              className="flex-1 min-w-[80px] rounded-full border border-slate-200 h-[26px] px-3 font-black uppercase text-[9px] tracking-widest text-[#68717A] bg-transparent data-[state=active]:border-transparent data-[state=active]:bg-[#115E8D] data-[state=active]:text-white transition-all data-[state=active]:shadow-sm"
            >
              Timing
            </TabsTrigger>
            <TabsTrigger
              value="details"
              className="flex-1 min-w-[80px] rounded-full border border-slate-200 h-[26px] px-3 font-black uppercase text-[9px] tracking-widest text-[#68717A] bg-transparent data-[state=active]:border-transparent data-[state=active]:bg-[#115E8D] data-[state=active]:text-white transition-all data-[state=active]:shadow-sm"
            >
              Details
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="overview"
          className="mt-0 flex-1 overflow-hidden min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 relative"
        >
          <Button
            onClick={() => setShowFullMatrix(true)}
            size="sm"
            variant="outline"
            className="absolute top-1.5 right-1.5 z-10 h-6 px-2 text-[9px] uppercase font-black bg-[#115E8D]/80 hover:bg-white text-white hover:text-[#115E8D] border-white/30 backdrop-blur-sm shadow-sm"
          >
            <Maximize2 className="w-3 h-3 mr-1" /> Expand
          </Button>
          <div className="w-full h-full overflow-hidden">
            <table className="w-full text-left border-collapse table-fixed select-none min-w-full">
              <thead>
                <tr className="bg-[#115E8D] text-white uppercase text-[9px] font-black tracking-widest leading-none h-[32px]">
                  <th className="p-1.5 pl-4 w-[28%] border-r border-[#115E8D]/20 truncate">
                    Equipment & Settings
                  </th>
                  {sessions
                    .slice(0, 6)
                    .reverse()
                    .map((s) => {
                      const timestamp = parseSessionDate(s.date);
                      return (
                        <th
                          key={s.id}
                          className="p-1.5 text-center border-r border-[#115E8D]/20 truncate w-[10%] opacity-90"
                        >
                          {timestamp > 0
                            ? new Date(timestamp).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })
                            : "--"}
                        </th>
                      );
                    })}
                  <th className="p-1.5 text-center bg-[#F06C22] text-white truncate w-[12%] border-l shadow-inner border-[#F06C22]/80">
                    TARGET
                  </th>
                </tr>
              </thead>
              <tbody className="text-[#115E8D] border-t border-slate-200">
                {machines
                  .sort((a, b) => (a.order || 0) - (b.order || 0))
                  .map((machine, idx) => {
                    const machineLogs = allLogs.filter(
                      (l) => l.machineId === machine.id,
                    );
                    const displaySessions = sessions.slice(0, 6).reverse();
                    const targetLog =
                      displaySessions.length > 0
                        ? machineLogs.find(
                            (l) =>
                              l.sessionId ===
                              displaySessions[displaySessions.length - 1].id,
                          )
                        : null;

                    return (
                      <tr
                        key={machine.id}
                        onClick={() => setSelectedInsightMachine(machine)}
                        className="even:bg-[#F9FAFB] odd:bg-white hover:bg-slate-100 hover:brightness-95 cursor-pointer transition-all h-[32px] group border-b border-slate-100 last:border-b-0"
                      >
                        <td className="p-1 pl-4 border-r border-slate-200/60 truncate align-middle relative overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#115E8D]/0 group-hover:bg-[#115E8D] transition-colors" />
                          <div className="flex flex-col justify-center translate-y-[1px]">
                            <div className="flex items-center gap-1 mb-0.5 max-w-full">
                              <span className="font-bold text-[11px] text-[#115E8D] leading-none truncate">
                                {machine.name}
                              </span>
                              {clientSettings[machine.id!]?.machineNotes?.some(
                                (n) => n.isImportant,
                              ) && (
                                <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                              )}
                            </div>
                            <span className="text-[7.5px] font-bold text-[#68717A] opacity-70 tracking-widest truncate leading-none uppercase">
                              {clientSettings[machine.id!]?.settings
                                ? Object.entries(
                                    clientSettings[machine.id!].settings,
                                  )
                                    .map(([k, v]) => `${k}:${v}`)
                                    .join(" ")
                                : "---"}
                            </span>
                          </div>
                        </td>
                        {displaySessions.map((s, sIdx) => {
                          const log = machineLogs.find(
                            (l) => l.sessionId === s.id,
                          );
                          const isLast = sIdx === displaySessions.length - 1;
                          const promptIncrease =
                            isLast && log?.repQuality === 3;

                          return (
                            <td
                              key={s.id}
                              className="p-0 border-r border-slate-200/60 align-middle px-1"
                            >
                              {log ? (
                                <div className="flex flex-col items-center justify-center leading-none tracking-tighter">
                                  <div className="flex items-center gap-0.5 mb-[2px]">
                                    <span
                                      className={`font-black text-[11px] sm:text-[12px] ${isLast ? "text-black" : "text-slate-700"}`}
                                    >
                                      {log.weight}
                                    </span>
                                    {promptIncrease && (
                                      <span className="text-[8px] text-[#F06C22] shrink-0 font-black ml-0.5 mt-[1px]">
                                        ▲
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span
                                      className={`font-extrabold text-[9px] ${
                                        isLast
                                          ? log.repQuality === 3
                                            ? "text-emerald-700"
                                            : log.repQuality === 2
                                              ? "text-amber-700"
                                              : log.repQuality === 1
                                                ? "text-rose-700"
                                                : "text-[#115E8D]"
                                          : log.repQuality === 3
                                            ? "text-emerald-700/80"
                                            : log.repQuality === 2
                                              ? "text-amber-700/80"
                                              : log.repQuality === 1
                                                ? "text-rose-700/80"
                                                : "text-slate-500"
                                      }`}
                                    >
                                      {log.repsLeft !== undefined &&
                                      log.repsRight !== undefined
                                        ? `${log.repsLeft}L|${log.repsRight}R`
                                        : log.isStaticHold
                                          ? `${log.seconds}s`
                                          : log.reps}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center w-full">
                                  <span className="text-[9px] text-slate-300 font-medium">
                                    --
                                  </span>
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-0 text-center bg-[#F06C22]/[0.03] align-middle px-1 group-hover:bg-[#F06C22]/10 transition-colors">
                          {targetLog ? (
                            <div className="flex flex-col items-center opacity-40 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                              <div className="flex items-center gap-0.5 mb-[2px]">
                                <span className="font-black text-[11px] sm:text-[12px] text-[#F06C22]">
                                  {targetLog.repQuality === 3
                                    ? Number(targetLog.weight) + 5
                                    : targetLog.weight}
                                </span>
                              </div>
                              <span className="font-extrabold text-[9px] text-[#F06C22]/70">
                                {targetLog.repsLeft !== undefined &&
                                targetLog.repsRight !== undefined
                                  ? `${targetLog.repsLeft}L|${targetLog.repsRight}R`
                                  : targetLog.isStaticHold
                                    ? `${targetLog.seconds}s`
                                    : targetLog.reps}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[9px] text-[#F06C22]/40 font-bold uppercase">
                              ---
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="routines">
          <div className="grid gap-6 lg:grid-cols-2">
            {["Routine A", "Routine B"].map((routineName) => {
              const routine = routines.find((r) => r.name === routineName);
              const isActiveB =
                routineName === "Routine B" && client?.isRoutineBActive;
              const isDisabled =
                routineName === "Routine B" && !client?.isRoutineBActive;

              if (isDisabled) {
                return (
                  <Card
                    key={routineName}
                    className="rounded-[40px] border-2 border-dashed border-muted flex items-center justify-center p-12 opacity-50"
                  >
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                        <Settings className="w-8 h-8 text-muted-foreground/30" />
                      </div>
                      <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                        Routine B Inactive
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl font-bold text-xs"
                        onClick={() => handleToggleRoutineB(true)}
                      >
                        Enable Optional Protocol
                      </Button>
                    </div>
                  </Card>
                );
              }

              return (
                <Card
                  key={routineName}
                  className={`rounded-[40px] border-2 shadow-xl overflow-hidden ${routineName === "Routine B" ? "border-amber-500/20 bg-amber-500/[0.02]" : ""}`}
                >
                  <CardHeader className="p-8 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black italic shadow-lg ${routineName === "Routine B" ? "bg-amber-500 text-white shadow-amber-500/20" : "bg-primary text-white shadow-primary/20"}`}
                        >
                          {routineName.split(" ")[1]}
                        </div>
                        <div>
                          <CardTitle className="text-xl font-black uppercase italic tracking-tighter">
                            {routineName}
                          </CardTitle>
                          <CardDescription className="text-[10px] font-bold uppercase tracking-widest">
                            Protocol Definition
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-xl font-black uppercase text-[9px] border-dashed"
                          onClick={() =>
                            handleApplyTemplate("STANDARD_MALE", routineName)
                          }
                        >
                          Apply Template
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-8 pt-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 max-h-[500px] sm:max-h-[600px] overflow-y-auto pr-2 custom-scrollbar py-2">
                      {machines
                        .sort((a, b) => (a.order || 0) - (b.order || 0))
                        .map((machine) => {
                          const routineMachineIds =
                            stagedMachineIds[routineName] || [];
                          const isIn = routineMachineIds.includes(machine.id!);
                          const seqPosition = isIn
                            ? routineMachineIds.indexOf(machine.id!) + 1
                            : null;

                          return (
                            <button
                              key={machine.id}
                              onClick={() =>
                                toggleMachineInRoutine(routineName, machine.id!)
                              }
                              className={`flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all text-left relative group
                              ${
                                isIn
                                  ? "bg-primary/5 border-primary shadow-md z-10"
                                  : "bg-muted/10 border-transparent opacity-40 hover:opacity-100 hover:border-muted"
                              }`}
                            >
                              <div
                                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 transition-all
                              ${
                                isIn
                                  ? "bg-primary text-white shadow-lg"
                                  : "bg-muted text-muted-foreground border-2 border-dashed border-muted-foreground/10"
                              }`}
                              >
                                {isIn ? (
                                  <span className="font-black text-[10px] sm:text-xs">
                                    {seqPosition}
                                  </span>
                                ) : (
                                  <Plus className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <span
                                  className={`text-[10px] sm:text-[11px] font-black uppercase tracking-tight truncate block ${isIn ? "text-primary" : "text-muted-foreground"}`}
                                >
                                  {machine.name}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </CardContent>
                  <CardFooter className="p-8 pt-0 border-t border-border/10 mt-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">
                        {stagedMachineIds[routineName]?.length || 0} Units
                        Assigned
                      </p>
                      {JSON.stringify(stagedMachineIds[routineName]) !==
                        JSON.stringify(
                          routines.find((r) => r.name === routineName)
                            ?.machineIds || [],
                        ) && (
                        <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest animate-pulse">
                          Pending Changes
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {routineName === "Routine B" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 font-bold text-[10px] uppercase"
                          onClick={() => handleToggleRoutineB(false)}
                        >
                          Disable
                        </Button>
                      )}
                      <Button
                        onClick={() => handleSaveRoutineConfig(routineName)}
                        disabled={isSavingRoutine[routineName]}
                        className="h-10 rounded-xl font-black uppercase italic text-[10px] tracking-widest px-6 bg-primary shadow-lg shadow-primary/20"
                      >
                        {isSavingRoutine[routineName]
                          ? "Saving..."
                          : "Apply Routine"}
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="focus" className="mt-0 flex-1 overflow-hidden min-h-0 bg-[#0A2E46] rounded-xl shadow-sm border border-slate-700">
          {client && authTrainer && (
            <ClientFocusDashboard 
              client={client} 
              trainer={authTrainer} 
              machines={machines} 
            />
          )}
        </TabsContent>

        <TabsContent value="history" className="h-[750px] relative">
          <div className="absolute top-0 right-0 z-10 p-4">
            <Button
              onClick={() => setView("chart-importer" as any)}
              className="bg-slate-900 hover:bg-slate-800 text-[#F06C22] border border-[#F06C22]/30 font-black h-8 px-4 text-[9px] uppercase tracking-widest shadow-lg"
            >
              <Scan className="w-3 h-3 mr-2" />
              Bulk Import (OCR)
            </Button>
          </div>
          {clientId && (
            <ClientHistoryCalendar
              clientId={clientId}
              machines={machines}
              trainers={trainers}
              user={user}
              allLogs={allLogs}
            />
          )}
        </TabsContent>

        <TabsContent value="reports">
          <Card className="rounded-[40px] border-2 shadow-xl overflow-hidden min-h-[400px]">
            <CardHeader className="p-8 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-black uppercase italic tracking-tighter">
                    Progress Report Archive
                  </CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-1">
                    Evaluations, Goals & Outcomes
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setView("progress-report")}
                  variant="default"
                  size="sm"
                  className="rounded-xl font-black uppercase text-[10px] tracking-widest h-11 bg-primary"
                >
                  <Plus className="w-4 h-4 mr-2" /> New Evaluation
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {progressReports.length > 0 ? (
                  progressReports
                    .sort(
                      (a, b) =>
                        parseSessionDate(b.date) - parseSessionDate(a.date),
                    )
                    .map((report) => (
                      <div
                        key={report.id}
                        className="p-6 hover:bg-muted/30 transition-colors group flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-muted/50 flex flex-col items-center justify-center border group-hover:bg-primary/5 group-hover:border-primary/20 transition-all font-black uppercase italic text-primary">
                            <span className="text-[10px] leading-none">
                              {report.date.split("-")[1]}/
                              {report.date.split("-")[2]}
                            </span>
                            <span className="text-[8px] opacity-30 mt-1">
                              {report.date.split("-")[0]}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-black italic uppercase tracking-tight text-foreground">
                                Client Progress Evaluation
                              </p>
                              <Badge
                                variant={
                                  report.status === "Finalized"
                                    ? "default"
                                    : "secondary"
                                }
                                className={`px-1.5 py-0 h-4 text-[8px] font-black uppercase border-none ${report.status === "Finalized" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}
                              >
                                {report.status || "Finalized"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 mt-1">
                              <span className="text-[9px] text-muted-foreground font-bold uppercase">
                                Trainer: {report.trainerName || "Team"}
                              </span>
                              <span className="text-[9px] text-muted-foreground font-bold uppercase">
                                Matrix Avg:{" "}
                                {report.performanceMatrix
                                  ? Math.round(
                                      ((report.performanceMatrix.posture
                                        ?.score || 0) +
                                        (report.performanceMatrix.pace?.score ||
                                          0) +
                                        (report.performanceMatrix.path?.score ||
                                          0) +
                                        (report.performanceMatrix.purpose
                                          ?.score || 0)) /
                                        4,
                                    )
                                  : 0}
                                %
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSelectReport(report.id!)}
                            className="rounded-xl font-black uppercase italic text-[10px] tracking-widest text-primary"
                          >
                            {report.status === "Draft"
                              ? "Resume Draft"
                              : "View / Present"}
                          </Button>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="p-24 text-center space-y-4">
                    <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto opacity-20" />
                    <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">
                      No progress reports registered in archive
                    </p>
                    <Button
                      variant="outline"
                      className="rounded-xl font-black uppercase text-[10px] tracking-widest border-2 mt-4"
                      onClick={() => setView("progress-report")}
                    >
                      Perform First Evaluation
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timing">
          <Card className="rounded-[40px] border-2 shadow-xl overflow-hidden min-h-[400px]">
            <CardHeader className="p-8 border-b bg-muted/20">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-black uppercase italic tracking-tighter">
                    Time Spent on Machines
                  </CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-1">
                    Efficiency & Pace Analytics
                  </CardDescription>
                </div>
                <div className="flex gap-4">
                  {(() => {
                    const completedSessions = sessions.filter(
                      (s) =>
                        s.status === "Completed" && s.startTime && s.endTime,
                    );
                    if (completedSessions.length === 0) return null;

                    const totalMins = completedSessions.reduce((acc, s) => {
                      return (
                        acc + (s.endTime!.toMillis() - s.startTime!.toMillis())
                      );
                    }, 0);
                    const avgMins = Math.round(
                      totalMins / completedSessions.length / 60000,
                    );

                    return (
                      <div className="text-right">
                        <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60">
                          Avg Session
                        </p>
                        <p className="text-sm font-black italic text-primary">
                          {avgMins}m
                        </p>
                      </div>
                    );
                  })()}
                  <Badge
                    variant="outline"
                    className="text-[9px] font-black bg-primary/10 text-primary border-primary/20"
                  >
                    Efficiency
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex flex-col md:flex-row h-[600px]">
              {/* Sidebar: Session List */}
              <div className="w-full md:w-64 border-r overflow-y-auto bg-muted/5 divide-y">
                {sessions
                  .filter((s) => s.status === "Completed")
                  .map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedTimingSessionId(s.id!)}
                      className={`w-full p-4 text-left hover:bg-white transition-all group ${selectedTimingSessionId === s.id ? "bg-white shadow-sm ring-1 ring-primary/5" : ""}`}
                    >
                      <p
                        className={`text-[10px] font-black uppercase tracking-tighter ${selectedTimingSessionId === s.id ? "text-primary" : "text-muted-foreground"}`}
                      >
                        {s.date}
                      </p>
                      <p className="text-xs font-bold truncate mt-1">
                        {s.routineName || "Free Session"}
                      </p>
                      {s.startTime && s.endTime && (
                        <p className="text-[9px] font-bold text-muted-foreground/60 uppercase mt-1">
                          {Math.round(
                            (s.endTime.toMillis() - s.startTime.toMillis()) /
                              60000,
                          )}{" "}
                          mins
                        </p>
                      )}
                    </button>
                  ))}
                {sessions.filter((s) => s.status === "Completed").length ===
                  0 && (
                  <div className="p-8 text-center opacity-20">
                    <Clock className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest leading-tight">
                      No data
                    </p>
                  </div>
                )}
              </div>

              {/* Main Content: Detailed Analysis */}
              <div className="flex-1 overflow-y-auto p-8">
                {(() => {
                  const focusSession =
                    sessions.find((s) => s.id === selectedTimingSessionId) ||
                    sessions[0];

                  if (!focusSession) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center opacity-20 space-y-4">
                        <Activity className="w-16 h-16" />
                        <p className="text-xs font-black uppercase tracking-widest">
                          Select a session for analysis
                        </p>
                      </div>
                    );
                  }

                  const sessionLogs = allLogs
                    .filter((l) => l.sessionId === focusSession.id)
                    .sort((a, b) => {
                      const timeA =
                        a.updatedAt?.toMillis?.() ||
                        a.createdAt?.toMillis?.() ||
                        0;
                      const timeB =
                        b.updatedAt?.toMillis?.() ||
                        b.createdAt?.toMillis?.() ||
                        0;
                      return timeA - timeB;
                    });

                  const startTime =
                    focusSession.startTime?.toMillis?.() ||
                    focusSession.createdAt?.toMillis?.();

                  return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex items-center justify-between border-b pb-4">
                        <div>
                          <h4 className="text-lg font-black uppercase italic text-primary">
                            {focusSession.date}
                          </h4>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">
                            {focusSession.routineName || "Free Protocol"}
                          </p>
                        </div>
                        {focusSession.startTime && focusSession.endTime && (
                          <div className="text-right">
                            <p className="text-xl font-black italic text-foreground leading-none">
                              {Math.round(
                                (focusSession.endTime.toMillis() -
                                  focusSession.startTime.toMillis()) /
                                  60000,
                              )}
                              m
                            </p>
                            <p className="text-[9px] font-black text-muted-foreground uppercase opacity-60">
                              Total Duration
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="grid gap-3">
                        {sessionLogs.map((log, idx) => {
                          const machine = machines.find(
                            (m) => m.id === log.machineId,
                          );
                          const logTime =
                            log.updatedAt?.toMillis?.() ||
                            log.createdAt?.toMillis?.();
                          const prevTime =
                            idx === 0
                              ? startTime
                              : sessionLogs[idx - 1].updatedAt?.toMillis?.() ||
                                sessionLogs[idx - 1].createdAt?.toMillis?.();

                          let durationMs = 0;
                          let durationStr = "---";
                          if (logTime && prevTime) {
                            durationMs = logTime - prevTime;
                            const mins = Math.floor(durationMs / 60000);
                            const secs = Math.floor(
                              (durationMs % 60000) / 1000,
                            );
                            durationStr =
                              mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
                          }

                          return (
                            <div
                              key={log.id}
                              className="flex items-center justify-between p-6 rounded-3xl bg-muted/20 border border-transparent hover:border-primary/20 hover:bg-white transition-all shadow-sm"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                                  <Dumbbell className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                  <p className="text-sm font-black uppercase tracking-tight">
                                    {machine?.name || "Unknown"}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">
                                      {idx === 0
                                        ? "Since Start"
                                        : "From Prev Unit"}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-black italic text-primary leading-none">
                                  {durationStr}
                                </p>
                              </div>
                            </div>
                          );
                        })}

                        {sessionLogs.length === 0 && (
                          <div className="p-12 text-center opacity-30">
                            <Clock className="w-10 h-10 mx-auto mb-3" />
                            <p className="text-xs font-black uppercase tracking-widest">
                              No timing logs for this session
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Machine Averages Summary */}
                      <div className="pt-8 border-t">
                        <h5 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">
                          Historical Machine Averages
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {machines.map((m) => {
                            const machineLogs = allLogs.filter(
                              (l) => l.machineId === m.id,
                            );
                            if (machineLogs.length < 2) return null;

                            let totalDiffMs = 0;
                            let count = 0;

                            machineLogs.forEach((l) => {
                              const s = sessions.find(
                                (sess) => sess.id === l.sessionId,
                              );
                              if (!s) return;

                              const sLogs = allLogs
                                .filter((log) => log.sessionId === s.id)
                                .sort((a, b) => {
                                  return (
                                    (a.updatedAt?.toMillis() ||
                                      a.createdAt?.toMillis()) -
                                    (b.updatedAt?.toMillis() ||
                                      b.createdAt?.toMillis())
                                  );
                                });

                              const idx = sLogs.findIndex(
                                (log) => log.id === l.id,
                              );
                              if (idx === -1) return;

                              const lTime =
                                l.updatedAt?.toMillis() ||
                                l.createdAt?.toMillis();
                              const pTime =
                                idx === 0
                                  ? s.startTime?.toMillis() ||
                                    s.createdAt?.toMillis()
                                  : sLogs[idx - 1].updatedAt?.toMillis() ||
                                    sLogs[idx - 1].createdAt?.toMillis();

                              if (lTime && pTime) {
                                totalDiffMs += lTime - pTime;
                                count++;
                              }
                            });

                            if (count === 0) return null;
                            const averageMs = totalDiffMs / count;
                            if (isNaN(averageMs)) return null;

                            const avgMins = Math.floor(averageMs / 60000);
                            const avgSecs = Math.round(
                              (averageMs % 60000) / 1000,
                            );

                            return (
                              <div
                                key={m.id}
                                className="p-4 rounded-2xl bg-muted/10 border border-muted flex items-center justify-between"
                              >
                                <span className="text-[10px] font-black uppercase text-muted-foreground truncate mr-2">
                                  {m.name}
                                </span>
                                <span className="text-[10px] font-black italic text-foreground whitespace-nowrap">
                                  {avgMins}m {avgSecs}s
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details">
          <div className="grid gap-6 lg:grid-cols-2 mb-6">
            <Card className="rounded-[40px] shadow-xl bg-slate-800 border-slate-700 text-white">
              <CardHeader className="p-8 border-b border-slate-700">
                <CardTitle className="text-xl font-black uppercase italic tracking-tighter">
                  Vitals & Demographics
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-[#38BDF8]">
                  Identity & Vital Statistics
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8 grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    First Name
                  </Label>
                  <Input
                    value={infoForm.firstName || ""}
                    onChange={(e) =>
                      setInfoForm((f) => ({ ...f, firstName: e.target.value }))
                    }
                    className="h-12 rounded-2xl font-black px-4 bg-slate-900 border-slate-700 text-white focus-visible:ring-[#38BDF8]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Last Name
                  </Label>
                  <Input
                    value={infoForm.lastName || ""}
                    onChange={(e) =>
                      setInfoForm((f) => ({ ...f, lastName: e.target.value }))
                    }
                    className="h-12 rounded-2xl font-black px-4 bg-slate-900 border-slate-700 text-white focus-visible:ring-[#38BDF8]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Age
                  </Label>
                  <Input
                    type="number"
                    value={infoForm.age ?? ""}
                    onChange={(e) =>
                      setInfoForm((f) => ({
                        ...f,
                        age: e.target.value ? parseInt(e.target.value) : null,
                      }))
                    }
                    className="h-12 rounded-2xl font-black px-4 bg-slate-900 border-slate-700 text-white focus-visible:ring-[#38BDF8]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Gender
                  </Label>
                  <Select
                    value={infoForm.gender || "Male"}
                    onValueChange={(v) =>
                      setInfoForm((f) => ({ ...f, gender: v as any }))
                    }
                  >
                    <SelectTrigger className="h-12 rounded-2xl font-black px-4 bg-slate-900 border-slate-700 text-white focus-visible:ring-[#38BDF8]">
                      <SelectValue placeholder="Select Gender" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white rounded-xl">
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Height
                  </Label>
                  <Input
                    value={infoForm.height || ""}
                    onChange={(e) =>
                      setInfoForm((f) => ({ ...f, height: e.target.value }))
                    }
                    className="h-12 rounded-2xl font-black px-4 bg-slate-900 border-slate-700 text-white focus-visible:ring-[#38BDF8]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Current Weight (lbs)
                  </Label>
                  <Input
                    value={infoForm.weight || ""}
                    onChange={(e) =>
                      setInfoForm((f) => ({ ...f, weight: e.target.value }))
                    }
                    className="h-12 rounded-2xl font-black px-4 bg-slate-900 border-slate-700 text-white focus-visible:ring-[#38BDF8]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Occupation
                  </Label>
                  <OccupationSelect
                    value={infoForm.occupation || ""}
                    onChange={(v) =>
                      setInfoForm((f) => ({ ...f, occupation: v }))
                    }
                    disabled={infoForm.isRetired}
                  />
                </div>
                <div className="space-y-2 flex flex-col justify-center">
                  <div className="flex items-center gap-4 mt-2">
                    <Switch
                      checked={infoForm.isRetired}
                      onCheckedChange={(v) =>
                        setInfoForm((f) => ({ ...f, isRetired: v }))
                      }
                      className="data-[state=checked]:bg-[#38BDF8]"
                    />
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                      Retired
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[40px] shadow-xl bg-slate-800 border-slate-700 text-white">
              <CardHeader className="p-8 border-b border-slate-700">
                <CardTitle className="text-xl font-black uppercase italic tracking-tighter">
                  Clinical Profiles
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-[#38BDF8]">
                  Orthopedic & Safety Flags
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    "Cardiac/Cardiovascular",
                    "Lumbar/Spine",
                    "Cervical/Neck",
                    "Joint Replacement",
                    "Osteoarthritis",
                    "Hypertension",
                    "Other",
                  ].map((ailment) => (
                    <label
                      key={ailment}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <div className="relative flex items-center justify-center">
                        <input
                          type="checkbox"
                          className="peer appearance-none w-5 h-5 border-2 border-slate-600 rounded bg-slate-900 checked:bg-[#38BDF8] checked:border-[#38BDF8] transition-all cursor-pointer"
                          checked={
                            infoForm.clinicalProfile?.includes(ailment) || false
                          }
                          onChange={(e) => {
                            const current = infoForm.clinicalProfile || [];
                            if (e.target.checked)
                              setInfoForm((f) => ({
                                ...f,
                                clinicalProfile: [...current, ailment],
                              }));
                            else
                              setInfoForm((f) => ({
                                ...f,
                                clinicalProfile: current.filter(
                                  (a) => a !== ailment,
                                ),
                              }));
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 peer-checked:opacity-100 pointer-events-none text-white">
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={4}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 group-hover:text-white transition-colors">
                        {ailment}
                      </span>
                    </label>
                  ))}
                </div>
                {infoForm.clinicalProfile?.includes("Other") && (
                  <div className="mt-6 space-y-2 animate-in fade-in slide-in-from-top-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Specific Ailments/Contraindications
                    </Label>
                    <Textarea
                      value={infoForm.clinicalNotes || ""}
                      onChange={(e) =>
                        setInfoForm((f) => ({
                          ...f,
                          clinicalNotes: e.target.value,
                        }))
                      }
                      className="min-h-[80px] rounded-2xl font-bold p-4 bg-slate-900 border-slate-700 text-white focus-visible:ring-[#38BDF8] transition-all"
                      placeholder="Specify the condition..."
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[40px] shadow-xl bg-slate-800 border-slate-700 text-white">
              <CardHeader className="p-8 border-b border-slate-700">
                <CardTitle className="text-xl font-black uppercase italic tracking-tighter">
                  Lifestyle & Recovery
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-[#38BDF8]">
                  Daily External Stressors
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Activity Level
                  </Label>
                  <Select
                    value={infoForm.activityLevel || "Moderate"}
                    onValueChange={(v) =>
                      setInfoForm((f) => ({ ...f, activityLevel: v as any }))
                    }
                  >
                    <SelectTrigger className="w-full h-12 bg-slate-900 border-slate-700 text-white font-bold rounded-2xl focus-visible:ring-[#38BDF8]">
                      <SelectValue placeholder="Select Activity" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white rounded-xl">
                      <SelectItem value="Sedentary">Sedentary</SelectItem>
                      <SelectItem value="Light">Light</SelectItem>
                      <SelectItem value="Moderate">Moderate</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Manual Labor">Manual Labor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Systemic Recovery (Sleep/Stress)
                  </Label>
                  <Select
                    value={infoForm.recoveryMetric || "Average"}
                    onValueChange={(v) =>
                      setInfoForm((f) => ({ ...f, recoveryMetric: v as any }))
                    }
                  >
                    <SelectTrigger className="w-full h-12 bg-slate-900 border-slate-700 text-white font-bold rounded-2xl focus-visible:ring-[#38BDF8]">
                      <SelectValue placeholder="Select Recovery" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white rounded-xl">
                      <SelectItem value="Poor">Poor</SelectItem>
                      <SelectItem value="Average">Average</SelectItem>
                      <SelectItem value="Optimal">Optimal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[40px] shadow-xl bg-slate-800 border-slate-700 text-white">
              <CardHeader className="p-8 border-b border-slate-700">
                <CardTitle className="text-xl font-black uppercase italic tracking-tighter">
                  Training Pedigree
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-[#38BDF8]">
                  Prior Lifting Experience
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Experience Level
                  </Label>
                  <Select
                    value={infoForm.trainingPedigree || "Novice"}
                    onValueChange={(v) =>
                      setInfoForm((f) => ({ ...f, trainingPedigree: v as any }))
                    }
                  >
                    <SelectTrigger className="w-full h-12 bg-slate-900 border-slate-700 text-white font-bold rounded-2xl focus-visible:ring-[#38BDF8]">
                      <SelectValue placeholder="Select Experience" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white rounded-xl">
                      <SelectItem value="Novice">
                        Novice (No lifting experience)
                      </SelectItem>
                      <SelectItem value="Intermediate">
                        Intermediate (Standard gym experience)
                      </SelectItem>
                      <SelectItem value="Advanced">
                        Advanced (Extensive free weights/machines)
                      </SelectItem>
                      <SelectItem value="Protocol Veteran">
                        Protocol Veteran (High-intensity/controlled protocols)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card className="rounded-[40px] shadow-xl bg-slate-800 border-slate-700 text-white">
                <CardHeader className="p-8 border-b border-slate-700">
                  <CardTitle className="text-xl font-black uppercase italic tracking-tighter">
                    Contact & Package
                  </CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-[#38BDF8]">
                    Communication & Account Standing
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-8 grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Email
                    </Label>
                    <Input
                      value={infoForm.email || ""}
                      onChange={(e) =>
                        setInfoForm((f) => ({ ...f, email: e.target.value }))
                      }
                      className="h-12 rounded-2xl font-black px-4 bg-slate-900 border-slate-700 text-white focus-visible:ring-[#38BDF8]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Phone
                    </Label>
                    <Input
                      value={infoForm.phone || ""}
                      onChange={(e) =>
                        setInfoForm((f) => ({ ...f, phone: e.target.value }))
                      }
                      className="h-12 rounded-2xl font-black px-4 bg-slate-900 border-slate-700 text-white focus-visible:ring-[#38BDF8]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Emergency Contact Name
                    </Label>
                    <Input
                      value={infoForm.emergencyContactName || ""}
                      onChange={(e) =>
                        setInfoForm((f) => ({
                          ...f,
                          emergencyContactName: e.target.value,
                        }))
                      }
                      className="h-12 rounded-2xl font-black px-4 bg-slate-900 border-slate-700 text-white focus-visible:ring-[#38BDF8]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Emergency Contact Phone
                    </Label>
                    <Input
                      value={infoForm.emergencyContactPhone || ""}
                      onChange={(e) =>
                        setInfoForm((f) => ({
                          ...f,
                          emergencyContactPhone: e.target.value,
                        }))
                      }
                      className="h-12 rounded-2xl font-black px-4 bg-slate-900 border-slate-700 text-white focus-visible:ring-[#38BDF8]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Package Tier
                    </Label>
                    <Select
                      value={infoForm.packageTier || "None"}
                      onValueChange={(
                        v: "6-Month" | "12-Month" | "18-Month" | "None",
                      ) => {
                        let sessionBalance = infoForm.remainingSessions || 0;
                        if (v === "6-Month") sessionBalance = 48;
                        else if (v === "12-Month") sessionBalance = 96;
                        else if (v === "18-Month") sessionBalance = 144;
                        else if (v === "None") sessionBalance = 2;
                        setInfoForm((f) => ({
                          ...f,
                          packageTier: v,
                          remainingSessions: sessionBalance,
                        }));
                      }}
                    >
                      <SelectTrigger className="w-full h-12 bg-slate-900 border-slate-700 text-white font-bold rounded-2xl focus-visible:ring-[#38BDF8]">
                        <SelectValue placeholder="Select Tier" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-white rounded-xl">
                        <SelectItem value="None">None / Trial</SelectItem>
                        <SelectItem value="6-Month">
                          6-Month (48 Sessions)
                        </SelectItem>
                        <SelectItem value="12-Month">
                          12-Month (96 Sessions)
                        </SelectItem>
                        <SelectItem value="18-Month">
                          18-Month VIP (144 Sessions)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Session Balance
                    </Label>
                    <Input
                      type="number"
                      value={infoForm.remainingSessions ?? ""}
                      onChange={(e) =>
                        setInfoForm((f) => ({
                          ...f,
                          remainingSessions: parseInt(e.target.value) || 0,
                        }))
                      }
                      className="h-12 rounded-2xl font-black px-4 bg-slate-900 border-slate-700 text-white focus-visible:ring-[#38BDF8]"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[40px] shadow-xl bg-slate-800 border-slate-700 text-white">
                <CardHeader className="p-8 border-b border-slate-700 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-black uppercase italic tracking-tighter">
                      Events & Reminders
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-[#38BDF8]">
                      Alerts & Follow-ups
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                          Event Type
                        </Label>
                        <Select
                          value={newEventForm.type}
                          onValueChange={(v: any) =>
                            setNewEventForm({ ...newEventForm, type: v })
                          }
                        >
                          <SelectTrigger className="w-full h-12 bg-slate-800 border-slate-700 text-white font-bold rounded-2xl focus-visible:ring-[#38BDF8]">
                            <SelectValue placeholder="Select Type..." />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700 text-white rounded-xl">
                            <SelectItem value="Progress Report">
                              Progress Report
                            </SelectItem>
                            <SelectItem value="InBody Scan">
                              InBody Scan
                            </SelectItem>
                            <SelectItem value="Routine Change">
                              Routine Change
                            </SelectItem>
                            <SelectItem value="Vacation">Vacation</SelectItem>
                            <SelectItem value="Birthday/Anniversary">
                              Birthday/Anniversary
                            </SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                          Date
                        </Label>
                        <Input
                          type="date"
                          value={newEventForm.date}
                          onChange={(e) =>
                            setNewEventForm((f) => ({
                              ...f,
                              date: e.target.value,
                            }))
                          }
                          className="h-12 rounded-2xl font-black px-4 bg-slate-800 border-slate-700 text-white focus-visible:ring-[#38BDF8]"
                        />
                      </div>
                    </div>
                    <div className="space-y-2 mb-4">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                        Event Title
                      </Label>
                      <Input
                        value={newEventForm.title}
                        onChange={(e) =>
                          setNewEventForm((f) => ({
                            ...f,
                            title: e.target.value,
                          }))
                        }
                        placeholder="Brief description..."
                        className="h-12 rounded-2xl font-bold px-4 bg-slate-800 border-slate-700 text-white focus-visible:ring-[#38BDF8]"
                      />
                    </div>
                    <div className="space-y-2 mb-6">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                        Notes
                      </Label>
                      <Textarea
                        value={newEventForm.notes}
                        onChange={(e) =>
                          setNewEventForm((f) => ({
                            ...f,
                            notes: e.target.value,
                          }))
                        }
                        className="min-h-[80px] rounded-3xl font-medium p-4 bg-slate-800 border-slate-700 text-white focus-visible:ring-[#38BDF8] resize-none"
                        placeholder="Optional details..."
                      />
                    </div>
                    <Button
                      onClick={handleAddEvent}
                      disabled={
                        !newEventForm.title ||
                        !newEventForm.date ||
                        isSavingEvent
                      }
                      className="w-full bg-[#38BDF8] hover:bg-[#0ea5e9] text-white font-black uppercase tracking-widest text-xs h-12 rounded-2xl transition-all"
                    >
                      {isSavingEvent ? "Adding..." : "Add Event"}
                    </Button>
                  </div>

                  {client?.events && client.events.length > 0 ? (
                    <div className="space-y-3 mt-8">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-4">
                        Scheduled Events
                      </h4>
                      {client.events
                        .sort(
                          (a, b) =>
                            new Date(b.date).getTime() -
                            new Date(a.date).getTime(),
                        )
                        .map((event) => (
                          <div
                            key={event.id}
                            className="flex flex-col gap-2 p-4 bg-slate-900 border border-slate-800 rounded-3xl group transition-all hover:bg-slate-800"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                <span
                                  className={cn(
                                    "text-[9px] font-black uppercase tracking-widest mb-1",
                                    event.priority === "High"
                                      ? "text-red-400"
                                      : event.priority === "Medium"
                                        ? "text-amber-400"
                                        : "text-slate-400",
                                  )}
                                >
                                  {event.type} • {event.priority} Priority
                                </span>
                                <span className="text-white font-bold">
                                  {event.title}
                                </span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-[10px] font-black tracking-widest uppercase text-slate-400 mb-1">
                                  {new Date(
                                    event.date + "T12:00:00",
                                  ).toLocaleDateString()}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteEvent(event.id)}
                                  className="h-8 w-8 p-0 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            {event.notes && (
                              <p className="text-xs text-slate-500 mt-1 font-medium bg-slate-900/50 p-3 flex rounded-xl">
                                {event.notes}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="rounded-[40px] shadow-sm bg-slate-900 border-slate-800 text-white">
                <CardHeader className="p-8">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] opacity-40">
                    System State
                  </h3>
                </CardHeader>
                <CardContent className="px-8 pb-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                      Active Client
                    </Label>
                    <Switch
                      checked={infoForm.isActive}
                      onCheckedChange={(v) =>
                        setInfoForm((f) => ({ ...f, isActive: v }))
                      }
                      className="data-[state=checked]:bg-emerald-500"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                      Enable Routine B
                    </Label>
                    <Switch
                      checked={infoForm.isRoutineBActive}
                      onCheckedChange={(v) =>
                        setInfoForm((f) => ({ ...f, isRoutineBActive: v }))
                      }
                      className="data-[state=checked]:bg-amber-500"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                        Initial Consult
                      </Label>
                      <p className="text-[8px] font-bold opacity-40 uppercase tracking-tighter mt-0.5">
                        Bypass Demo Screen
                      </p>
                    </div>
                    <Switch
                      checked={infoForm.consultationCompleted}
                      onCheckedChange={(v) =>
                        setInfoForm((f) => ({ ...f, consultationCompleted: v }))
                      }
                      className="data-[state=checked]:bg-[#F06C22]"
                    />
                  </div>
                  <div className="pt-6 border-t border-slate-800 mt-6 pb-2">
                    <Button
                      variant="outline"
                      className="w-full h-12 rounded-2xl border-red-500/20 text-red-500 hover:bg-red-500/10 hover:text-red-400 font-black uppercase tracking-widest text-[10px] transition-all bg-transparent"
                      onClick={() => setIsDeleting(true)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Client Account
                    </Button>
                  </div>
                  <div className="pt-2">
                    <Button
                      disabled={isSavingInfo}
                      onClick={handleSaveInfo}
                      className="w-full h-16 rounded-3xl bg-[#F06C22] hover:bg-[#ea580c] text-white font-black uppercase italic text-xs tracking-widest shadow-[0_0_20px_rgba(240,108,34,0.3)] transition-all"
                    >
                      {isSavingInfo ? "Processing..." : "Save All Changes"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <AnimatePresence>
        {showFullChart && clientId && (
          <WorkoutChartGrid
            clientId={clientId}
            clients={clients}
            machines={machines}
            onBack={() => setShowFullChart(false)}
            user={user}
          />
        )}
      </AnimatePresence>

      <Dialog open={isDeleting} onOpenChange={setIsDeleting}>
        <DialogContent className="rounded-[40px] border-none shadow-2xl p-0 overflow-hidden max-w-sm">
          <div className="bg-red-600 p-8 flex flex-col items-center gap-4 text-white">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-black uppercase italic tracking-tighter leading-none">
                Confirm Deletion
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-widest mt-2 opacity-80">
                This action is permanent
              </p>
            </div>
          </div>
          <div className="p-8 space-y-6 text-center bg-white">
            <p className="text-sm font-medium text-muted-foreground leading-relaxed">
              Are you absolutely sure you want to delete{" "}
              <span className="font-black text-foreground">
                {" "}
                {client.firstName} {client.lastName}'s
              </span>{" "}
              profile? All historical session data and machine settings will be
              lost.
            </p>
            <div className="flex flex-col gap-3">
              <Button
                variant="destructive"
                className="h-14 rounded-2xl font-black uppercase italic tracking-widest text-xs shadow-xl shadow-red-200"
                onClick={() => {
                  if (client.id) onDelete(client.id);
                  setIsDeleting(false);
                }}
              >
                Delete Everything
              </Button>
              <Button
                variant="ghost"
                className="h-12 rounded-2xl font-bold text-muted-foreground"
                onClick={() => setIsDeleting(false)}
              >
                Go Back
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <MachineInsightsModal
        client={client}
        machine={selectedInsightMachine}
        onClose={() => setSelectedInsightMachine(null)}
      />

      <Dialog
        open={isEditingSessionCount}
        onOpenChange={setIsEditingSessionCount}
      >
        <DialogContent className="rounded-3xl border-slate-700 bg-slate-900 shadow-2xl p-6 sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase text-white italic tracking-tighter">
              Edit Session Count
            </DialogTitle>
            <DialogDescription className="text-xs uppercase tracking-widest text-[#38BDF8] font-bold">
              Adjust {client.firstName}'s total sessions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-white font-bold text-xs uppercase tracking-widest">
                Total Sessions completed
              </Label>
              <Input
                type="number"
                value={sessionCountInput}
                onChange={(e) => setSessionCountInput(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white font-black text-lg h-12 focus-visible:ring-[#38BDF8]"
                placeholder="0"
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setIsEditingSessionCount(false)}
                className="flex-1 border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded-xl font-black uppercase tracking-widest text-[10px]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveSessionCount}
                className="flex-[2] bg-[#38BDF8] hover:bg-[#0284c7] text-white rounded-xl font-black uppercase tracking-widest text-[10px]"
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showFullMatrix} onOpenChange={setShowFullMatrix}>
        <DialogContent className="max-w-[100vw] max-h-[100vh] w-screen h-screen m-0 p-4 sm:p-6 rounded-none sm:rounded-none border-none shadow-none bg-[#FAF9F6] overflow-hidden flex flex-col [&>button.absolute.right-4.top-4]:hidden focus:outline-none">
          <DialogHeader className="shrink-0 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-wrap relative">
              <DialogTitle className="text-xl sm:text-2xl font-black uppercase italic tracking-tighter text-[#115E8D]">
                Expanded Machine Matrix
              </DialogTitle>
              <div className="flex gap-2 bg-white p-1 rounded-lg border border-slate-200 self-start">
                <Button
                  size="sm"
                  variant={matrixRoutineFilter === "all" ? "default" : "ghost"}
                  onClick={() => setMatrixRoutineFilter("all")}
                  className={cn(
                    "h-7 px-3 text-[10px] font-black uppercase tracking-widest",
                    matrixRoutineFilter === "all"
                      ? "bg-[#115E8D] hover:bg-[#115E8D]/90 text-white"
                      : "text-[#68717A]",
                  )}
                >
                  All
                </Button>
                <Button
                  size="sm"
                  variant={matrixRoutineFilter === "A" ? "default" : "ghost"}
                  onClick={() => setMatrixRoutineFilter("A")}
                  className={cn(
                    "h-7 px-3 text-[10px] font-black uppercase tracking-widest",
                    matrixRoutineFilter === "A"
                      ? "bg-[#115E8D] hover:bg-[#115E8D]/90 text-white"
                      : "text-[#68717A]",
                  )}
                >
                  Routine A
                </Button>
                {client?.isRoutineBActive && (
                  <Button
                    size="sm"
                    variant={matrixRoutineFilter === "B" ? "default" : "ghost"}
                    onClick={() => setMatrixRoutineFilter("B")}
                    className={cn(
                      "h-7 px-3 text-[10px] font-black uppercase tracking-widest",
                      matrixRoutineFilter === "B"
                        ? "bg-[#115E8D] hover:bg-[#115E8D]/90 text-white"
                        : "text-[#68717A]",
                    )}
                  >
                    Routine B
                  </Button>
                )}
              </div>
              <Button
                onClick={() => setShowFullMatrix(false)}
                variant="ghost"
                size="sm"
                className="absolute -top-2 right-0 sm:top-0 sm:right-0 bg-slate-200 hover:bg-slate-300 text-slate-700 h-8 px-3 rounded-lg text-xs font-black uppercase"
              >
                Close
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm relative">
            <table className="w-full text-left border-collapse table-fixed select-none min-w-max">
              <thead className="sticky top-0 z-30 shadow-sm">
                <tr className="bg-[#115E8D] text-white uppercase text-[9px] font-black tracking-widest leading-none h-[32px]">
                  <th className="p-2 pl-4 w-[150px] border-r border-[#115E8D]/20 truncate md:sticky left-0 bg-[#115E8D] z-40 shadow-[1px_0_0_rgba(255,255,255,0.1)]">
                    Machine
                  </th>
                  {sessions
                    .slice()
                    .reverse()
                    .map((s) => {
                      const timestamp = parseSessionDate(s.date);
                      return (
                        <th
                          key={s.id}
                          className="p-2 text-center border-r border-[#115E8D]/20 truncate w-[80px] opacity-90 h-[32px]"
                        >
                          {timestamp > 0
                            ? new Date(timestamp).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })
                            : "--"}
                        </th>
                      );
                    })}
                </tr>
              </thead>
              <tbody className="text-[#115E8D] border-t border-slate-200 relative z-0">
                {machines
                  .sort((a, b) => (a.order || 0) - (b.order || 0))
                  .filter((m) => {
                    if (matrixRoutineFilter === "all") return true;
                    // If filtering by A or B, check if it's in the respective routine
                    const targetRoutine = routines.find(r => r.name === `Routine ${matrixRoutineFilter}`);
                    return targetRoutine?.machineIds.includes(m.id!) || false;
                  })
                  .map((machine, idx) => {
                    const machineLogs = allLogs.filter(
                      (l) => l.machineId === machine.id,
                    );
                    const displaySessions = sessions.slice().reverse();

                    return (
                      <tr
                        key={machine.id}
                        className="even:bg-[#F9FAFB] odd:bg-white hover:bg-slate-50 cursor-pointer h-[36px] group border-b border-slate-100 last:border-b-0 transition-colors"
                      >
                        <td className="p-1.5 pl-4 border-r border-slate-200/60 truncate align-middle relative overflow-hidden md:sticky left-0 bg-inherit z-20 w-[150px] shadow-[1px_0_0_rgba(0,0,0,0.05)] text-left">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#115E8D]/0 group-hover:bg-[#115E8D] transition-colors" />
                          <div className="flex flex-col justify-center">
                            <div className="flex items-center gap-1 max-w-full">
                              <span className="font-bold text-[11px] text-[#115E8D] leading-none truncate block">
                                {machine.name.split('-')[0].trim()}
                              </span>
                              {clientSettings[machine.id!]?.machineNotes?.some(
                                (n) => n.isImportant,
                              ) && (
                                <AlertCircle className="w-3 h-3 text-red-500 shrink-0 inline-block align-middle" />
                              )}
                            </div>
                          </div>
                        </td>
                        {displaySessions.map((s, sIdx) => {
                          const log = machineLogs.find(
                            (l) => l.sessionId === s.id,
                          );

                          return (
                            <td
                              key={s.id}
                              className={cn(
                                "p-1.5 text-center border-r border-slate-200/60 font-bold text-[11px] truncate align-middle w-[80px]",
                                log ? "text-[#115E8D]" : "text-slate-300",
                              )}
                            >
                              {log ? `${log.weight} × ${log.reps}` : "--"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
