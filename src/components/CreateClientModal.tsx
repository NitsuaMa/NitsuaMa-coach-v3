import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserPlus, Loader2, Info, CheckCircle2, FileUp, AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Client } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { cn } from '@/lib/utils';
import { OccupationSelect } from './OccupationSelect';

interface CreateClientModalProps {
  clients: Client[];
  initialName?: string;
  onClose: () => void;
  onClientCreated: (clientId: string, routeToImporter?: boolean) => void;
}

const ORTHO_FLAGS = [
  "Lumbar/Spine", 
  "Cardiac", 
  "Osteoarthritis", 
  "Shoulder/Rotator", 
  "Knee/Hip Replacement", 
  "Hypertension", 
  "Diabetes", 
  "Osteoporosis"
];

export function CreateClientModal({ clients, initialName = '', onClose, onClientCreated }: CreateClientModalProps) {
  const nameParts = initialName.trim().split(' ');
  const [firstName, setFirstName] = useState(nameParts[0] || '');
  const [lastName, setLastName] = useState(nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [activeTab, setActiveTab] = useState<'prospect' | 'existing'>('prospect');
  
  // Custom Fields
  const [leadSource, setLeadSource] = useState('Referral');
  const [referredBy, setReferredBy] = useState('');
  
  // Expanded Clinical Schema
  const [occupation, setOccupation] = useState('');
  const [isRetired, setIsRetired] = useState(false);
  const [activityLevel, setActivityLevel] = useState<any>('');
  const [recoveryMetric, setRecoveryMetric] = useState<any>('');
  const [trainingPedigree, setTrainingPedigree] = useState<any>('');
  const [clinicalProfile, setClinicalProfile] = useState<string[]>([]);
  const [clinicalNotes, setClinicalNotes] = useState('');
  
  // Migration Fields
  const [routeToImporter, setRouteToImporter] = useState(true);
  
  // Submission & Validation States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<Client | null>(null);

  const toggleClinicalFlag = (flag: string) => {
    setClinicalProfile(prev => 
      prev.includes(flag) ? prev.filter(f => f !== flag) : [...prev, flag]
    );
  };

  const executeSave = async (force: boolean = false) => {
    if (!firstName || !lastName) return;
    
    if (!force) {
      const exactMatch = clients.find(c => 
        c.firstName.toLowerCase() === firstName.toLowerCase() && 
        c.lastName.toLowerCase() === lastName.toLowerCase()
      );
      if (exactMatch) {
        setDuplicateWarning(exactMatch);
        return;
      }
    }
    
    setIsSubmitting(true);
    
    try {
      const clientData: any = {
        firstName,
        lastName,
        phone,
        email,
        isActive: true,
        completedSessions: 0,
        sessionCount: 0,
        remainingSessions: activeTab === 'prospect' ? 1 : 10,
        gender: "Male" as "Male",
        height: "5'10\"",
        consultationCompleted: activeTab === 'existing',
        requiresConsultation: activeTab === 'prospect',
        leadSource,
        referredBy,
        occupation,
        isRetired,
        clinicalProfile,
        clinicalNotes
      };
      
      // Only include optional fields if they have values to avoid 'undefined' errors
      if (activityLevel) clientData.activityLevel = activityLevel;
      if (recoveryMetric) clientData.recoveryMetric = recoveryMetric;
      if (trainingPedigree) clientData.trainingPedigree = trainingPedigree;
      
      const docRef = await addDoc(collection(db, 'clients'), {
        ...clientData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      onClientCreated(docRef.id, activeTab === 'existing' && routeToImporter);
      onClose();
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'clients');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveClick = () => executeSave(false);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6 bg-slate-950/90 backdrop-blur-md">
      <Card className="w-full max-w-3xl bg-slate-900 border border-slate-700 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col max-h-[95vh] rounded-[32px] overflow-hidden relative">
        
        {duplicateWarning && (
          <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-slate-900 border border-amber-500 rounded-[24px] p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-2 bg-amber-500"></div>
              <div className="flex flex-col items-center text-center gap-6">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Duplicate Found</h3>
                  <p className="text-slate-400 font-medium text-sm leading-relaxed">
                    A client named <span className="text-white font-bold">{duplicateWarning.firstName} {duplicateWarning.lastName}</span> already exists in the system. Are you sure you want to create a duplicate profile?
                  </p>
                </div>
                <div className="flex gap-4 w-full mt-4">
                  <Button 
                    variant="outline" 
                    className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                    onClick={() => {
                      if (duplicateWarning.id) {
                        onClientCreated(duplicateWarning.id, false);
                      }
                      onClose();
                    }}
                  >
                    Cancel & View Existing
                  </Button>
                  <Button 
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-black uppercase tracking-wider"
                    onClick={() => executeSave(true)}
                  >
                    Force Create Duplicate
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="p-8 pb-4 shrink-0 border-b border-slate-800">
          <div className="flex bg-slate-800 p-1.5 rounded-2xl border border-slate-700/50 w-full shadow-2xl">
            <button
              onClick={() => setActiveTab('prospect')}
              className={cn(
                "flex-1 py-4 text-sm md:text-base font-black uppercase tracking-widest rounded-xl transition-all duration-300",
                activeTab === 'prospect' 
                  ? "bg-[#F06C22] text-white shadow-[0_0_20px_rgba(240,108,34,0.3)]" 
                  : "text-slate-500 hover:text-white"
              )}
            >
              New Prospect
            </button>
            <button
              onClick={() => setActiveTab('existing')}
              className={cn(
                "flex-1 py-4 text-sm md:text-base font-black uppercase tracking-widest rounded-xl transition-all duration-300",
                activeTab === 'existing' 
                  ? "bg-[#F06C22] text-white shadow-[0_0_20px_rgba(240,108,34,0.3)]" 
                  : "text-slate-500 hover:text-white"
              )}
            >
              Existing Client
            </button>
          </div>
        </div>

        <CardContent className="flex-1 p-8 space-y-8 overflow-y-auto custom-scrollbar bg-slate-900">
          
          {/* Identity Group */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#F06C22] border-b border-slate-800 pb-2">Client Identity</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">First Name</Label>
                <Input 
                  value={firstName} onChange={e => setFirstName(e.target.value)}
                  className="h-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:border-[#F06C22] rounded-xl font-bold"
                  placeholder="First"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Last Name</Label>
                <Input 
                  value={lastName} onChange={e => setLastName(e.target.value)}
                  className="h-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:border-[#F06C22] rounded-xl font-bold"
                  placeholder="Last"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Email (Optional)</Label>
                <Input 
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="h-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:border-[#F06C22] rounded-xl font-bold"
                  placeholder="name@email.com" type="email"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Phone</Label>
                <Input 
                  value={phone} onChange={e => setPhone(e.target.value)}
                  className="h-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:border-[#F06C22] rounded-xl font-bold"
                  placeholder="555-555-5555" type="tel"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Lead Source</Label>
                <Select value={leadSource} onValueChange={setLeadSource}>
                  <SelectTrigger className="h-12 bg-slate-800 border-slate-700 text-white font-bold rounded-xl">
                    <SelectValue placeholder="How did they hear about us?" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl">
                    <SelectItem value="Referral">Referral / Word of Mouth</SelectItem>
                    <SelectItem value="Web Search">Google / Web Search</SelectItem>
                    <SelectItem value="Social Media">Social Media (FB/IG)</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Referred By (Optional)</Label>
                <Input 
                  value={referredBy} onChange={e => setReferredBy(e.target.value)}
                  className="h-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:border-[#F06C22] rounded-xl font-bold"
                  placeholder="Client Name"
                />
              </div>
            </div>
          </div>

          {/* Clinical Demographic Group */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#F06C22] border-b border-slate-800 pb-2">Clinical Demographics</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Occupation</Label>
                  <div className="flex items-center space-x-2 mr-1">
                    <Checkbox id="retired" checked={isRetired} onCheckedChange={(v) => setIsRetired(!!v)} className="w-3.5 h-3.5" />
                    <label htmlFor="retired" className="text-[10px] font-bold text-slate-400 cursor-pointer">Unemployed/Retired</label>
                  </div>
                </div>
                <OccupationSelect 
                  value={occupation} 
                  onChange={setOccupation} 
                  disabled={isRetired}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Activity Level</Label>
                <Select value={activityLevel} onValueChange={setActivityLevel}>
                  <SelectTrigger className="h-12 bg-slate-800 border-slate-700 text-white font-bold rounded-xl">
                    <SelectValue placeholder="Select Lifestyle" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl">
                    <SelectItem value="Sedentary">Sedentary (Desk/Office)</SelectItem>
                    <SelectItem value="Light">Light (Walking/Standing)</SelectItem>
                    <SelectItem value="Moderate">Moderate (Active Hobbies)</SelectItem>
                    <SelectItem value="High">High (Competitive/Athletic)</SelectItem>
                    <SelectItem value="Manual Labor">Manual Labor (Heavy lifting)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Training Pedigree</Label>
                <Select value={trainingPedigree} onValueChange={setTrainingPedigree}>
                  <SelectTrigger className="h-12 bg-slate-800 border-slate-700 text-white font-bold rounded-xl">
                    <SelectValue placeholder="Experience Level" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl">
                    <SelectItem value="Novice">Novice (Little to no lifting)</SelectItem>
                    <SelectItem value="Intermediate">Intermediate (Casual gym-goer)</SelectItem>
                    <SelectItem value="Advanced">Advanced (Prior bodybuilding/powerlifting)</SelectItem>
                    <SelectItem value="Protocol Veteran">Protocol Veteran (Prior HIT training)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Baseline Recovery Capacity</Label>
                <Select value={recoveryMetric} onValueChange={setRecoveryMetric}>
                  <SelectTrigger className="h-12 bg-slate-800 border-slate-700 text-white font-bold rounded-xl">
                    <SelectValue placeholder="Select Recovery Metric" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl">
                    <SelectItem value="Poor">Poor (High stress, bad sleep)</SelectItem>
                    <SelectItem value="Average">Average (Normal stress, adequate sleep)</SelectItem>
                    <SelectItem value="Optimal">Optimal (Low stress, excellent sleep)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Orthopedic Group */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#F06C22] border-b border-slate-800 pb-2">Medical & Orthopedic</h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {ORTHO_FLAGS.map(flag => (
                <div 
                  key={flag}
                  onClick={() => toggleClinicalFlag(flag)}
                  className={cn(
                    "p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors user-select-none",
                    clinicalProfile.includes(flag) 
                      ? "bg-[#F06C22]/10 border-[#F06C22] text-[#F06C22]" 
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
                  )}
                >
                  <Checkbox 
                    checked={clinicalProfile.includes(flag)}
                    className={cn("pointer-events-none data-[state=checked]:bg-[#F06C22] data-[state=checked]:border-[#F06C22]")}
                  />
                  <span className="text-xs font-bold leading-tight">{flag}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 mt-4">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Clinical Notes & Exceptions</Label>
              <Textarea 
                value={clinicalNotes}
                onChange={e => setClinicalNotes(e.target.value)}
                placeholder="Include details about the injuries, recent surgeries, medications, or specific modifications required..."
                className="min-h-[100px] bg-slate-800 border-slate-700 text-white rounded-xl font-medium placeholder:text-slate-600 focus:border-[#F06C22] resize-none"
              />
            </div>
          </div>

          {activeTab === 'existing' && (
            <div className="space-y-4">
               <h3 className="text-xs font-black uppercase tracking-widest text-[#F06C22] border-b border-slate-800 pb-2">Migration Protocol</h3>
               <div 
                  className={cn(
                    "flex items-center gap-4 p-5 rounded-[24px] border transition-all cursor-pointer",
                    routeToImporter 
                      ? "bg-slate-800 border-[#F06C22]/50 shadow-[0_0_20px_rgba(240,108,34,0.1)]" 
                      : "bg-slate-900 border-slate-800 hover:border-slate-700"
                  )}
                  onClick={() => setRouteToImporter(!routeToImporter)}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0",
                    routeToImporter ? "bg-[#F06C22] border-[#F06C22]" : "border-slate-600"
                  )}>
                    {routeToImporter && <CheckCircle2 className="w-4 h-4 text-slate-900" />}
                  </div>
                  <div className="flex flex-col">
                    <p className={cn("text-[15px] font-black uppercase tracking-tight", routeToImporter ? 'text-[#F06C22]' : 'text-slate-300')}>Route to FileMaker Importer</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Send immediately to historical data ingestion after creation.</p>
                  </div>
                </div>
            </div>
          )}

        </CardContent>

        <div className="p-6 bg-slate-900 border-t border-slate-800 flex items-center gap-4 shrink-0 z-50 mt-auto">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="flex-1 h-14 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] text-slate-500 hover:text-white hover:bg-slate-800 transition-all border border-slate-800"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSaveClick}
            disabled={isSubmitting || !firstName || !lastName}
            className="flex-[2] h-14 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl transition-all active:scale-95 bg-[#F06C22] hover:bg-[#F06C22]/90 text-white"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <span className="flex items-center gap-2">
                {activeTab === 'prospect' ? <UserPlus className="w-4 h-4" /> : <FileUp className="w-4 h-4" />}
                {activeTab === 'prospect' ? 'Create Prospect Profile' : 'Initialize Migration Profile'}
              </span>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}

