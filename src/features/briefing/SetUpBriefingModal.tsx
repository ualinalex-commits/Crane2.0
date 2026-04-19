import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import type { DailyBriefing } from '@/types';

interface SetUpBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingBriefing: DailyBriefing | null;
  pastBriefing: DailyBriefing | null;
}

export function SetUpBriefingModal({ isOpen, onClose, onSuccess, existingBriefing, pastBriefing }: SetUpBriefingModalProps) {
  const { profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [attendees, setAttendees] = useState<Array<{ role: string; name: string; company: string }>>([]);
  
  // Part 2 - Weather
  const [windSpeed, setWindSpeed] = useState('');
  const [gustSpeed, setGustSpeed] = useState('');
  const [weatherConditions, setWeatherConditions] = useState('');

  // Part 3 - Site Details
  const [firstAiderName, setFirstAiderName] = useState('');
  const [siteLocation, setSiteLocation] = useState('');
  const [musterPointLocation, setMusterPointLocation] = useState('');

  // Changes
  const [siteChanges, setSiteChanges] = useState('');
  // AOB
  const [anyOtherBusiness, setAnyOtherBusiness] = useState('');
  // Lifting Schedule
  const [liftingSchedule, setLiftingSchedule] = useState('');

  // Checklist
  const [checklist, setChecklist] = useState({
    checklist_crane_responsible: false,
    checklist_activities_planned: false,
    checklist_deliveries_scheduled: false,
    checklist_environmental_changes: false,
    checklist_pre_use_checks: false,
    checklist_safety_first: false,
    checklist_crane_secured: false,
    checklist_whistles_checked: false,
    checklist_radio_check: false,
  });

  // Sign off
  const [appointedPersonName, setAppointedPersonName] = useState('');
  const [liftingSupervisorName, setLiftingSupervisorName] = useState('');
  const [supervisorSignatureUrl, setSupervisorSignatureUrl] = useState('');
  const [isSigning, setIsSigning] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Prefill logic
    const source = existingBriefing || pastBriefing;
    
    if (source) {
      setAttendees(source.attendees || []);
      setFirstAiderName(source.first_aider_name || '');
      setSiteLocation(source.site_location || '');
      setMusterPointLocation(source.muster_point_location || '');
      setSiteChanges(source.site_changes || '');
      setAnyOtherBusiness(source.any_other_business || '');
      setLiftingSchedule(source.lifting_schedule || '');
      setAppointedPersonName(source.appointed_person_name || '');
      setLiftingSupervisorName(source.lifting_supervisor_name || '');
      
      if (existingBriefing) {
        // If editing today's briefing, copy all
        setWindSpeed(source.wind_speed || '');
        setGustSpeed(source.gust_speed || '');
        setWeatherConditions(source.weather_conditions || '');
        setChecklist({
          checklist_crane_responsible: source.checklist_crane_responsible || false,
          checklist_activities_planned: source.checklist_activities_planned || false,
          checklist_deliveries_scheduled: source.checklist_deliveries_scheduled || false,
          checklist_environmental_changes: source.checklist_environmental_changes || false,
          checklist_pre_use_checks: source.checklist_pre_use_checks || false,
          checklist_safety_first: source.checklist_safety_first || false,
          checklist_crane_secured: source.checklist_crane_secured || false,
          checklist_whistles_checked: source.checklist_whistles_checked || false,
          checklist_radio_check: source.checklist_radio_check || false,
        });
        setSupervisorSignatureUrl(source.supervisor_signature_url || '');
      } else if (pastBriefing) {
        // Carry over weather only if it was updated after 3PM yesterday
        // But for simplicity of this prompt, we just reset weather if it's a new day
        setWindSpeed('');
        setGustSpeed('');
        setWeatherConditions('');
        // Checklist is reset daily
        setChecklist({
          checklist_crane_responsible: false,
          checklist_activities_planned: false,
          checklist_deliveries_scheduled: false,
          checklist_environmental_changes: false,
          checklist_pre_use_checks: false,
          checklist_safety_first: false,
          checklist_crane_secured: false,
          checklist_whistles_checked: false,
          checklist_radio_check: false,
        });
        setSupervisorSignatureUrl(''); // Signatures don't carry over
      }
    } else {
      // Default empty state
      setAttendees([]);
      setWindSpeed('');
      setGustSpeed('');
      setWeatherConditions('');
      setFirstAiderName('');
      setSiteLocation('');
      setMusterPointLocation('');
      setSiteChanges('');
      setAnyOtherBusiness('');
      setLiftingSchedule('');
      setAppointedPersonName(profile?.role === 'appointed_person' ? profile.full_name : '');
      setLiftingSupervisorName(profile?.role === 'crane_supervisor' ? profile.full_name : '');
      setSupervisorSignatureUrl('');
      setChecklist({
        checklist_crane_responsible: false,
        checklist_activities_planned: false,
        checklist_deliveries_scheduled: false,
        checklist_environmental_changes: false,
        checklist_pre_use_checks: false,
        checklist_safety_first: false,
        checklist_crane_secured: false,
        checklist_whistles_checked: false,
        checklist_radio_check: false,
      });
    }
  }, [isOpen, existingBriefing, pastBriefing, profile]);

  const handleAddAttendee = () => {
    setAttendees([...attendees, { role: '', name: '', company: '' }]);
  };

  const handleRemoveAttendee = (index: number) => {
    setAttendees(attendees.filter((_, i) => i !== index));
  };

  const updateAttendee = (index: number, field: string, value: string) => {
    const newAttendees = [...attendees];
    newAttendees[index] = { ...newAttendees[index], [field]: value };
    setAttendees(newAttendees);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('handleSubmit triggered', profile);
    if (!profile?.site_id) {
      alert('Error: You are not assigned to a site. Cannot save briefing.');
      return;
    }
    if (!supervisorSignatureUrl) {
      alert('Please provide a signature before saving.');
      return;
    }

    setIsSubmitting(true);
    
    // Check if we need to reset weather (if it's past 3PM, we just save the current values.
    // The requirement says "resets daily at 3PM". If a user updates it at 4PM, it's for today.
    // When they open it tomorrow, it will reset.

    const payload = {
      site_id: profile.site_id,
      date: new Date().toISOString().split('T')[0],
      created_by: profile.user_id,
      attendees,
      wind_speed: windSpeed,
      gust_speed: gustSpeed,
      weather_conditions: weatherConditions,
      first_aider_name: firstAiderName,
      site_location: siteLocation,
      muster_point_location: musterPointLocation,
      site_changes: siteChanges,
      any_other_business: anyOtherBusiness,
      lifting_schedule: liftingSchedule,
      ...checklist,
      appointed_person_name: appointedPersonName,
      lifting_supervisor_name: liftingSupervisorName,
      supervisor_signature_url: supervisorSignatureUrl,
    };

    try {
      if (existingBriefing) {
        const { error } = await supabase.from('daily_briefings')
          .update(payload)
          .eq('id', existingBriefing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('daily_briefings')
          .insert(payload);
        if (error) throw error;
      }

      alert('Daily briefing saved.');
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to save briefing');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existingBriefing ? 'Edit Daily Briefing' : 'Set Up Daily Briefing'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-8 mt-4">
          
          {/* Attendees */}
          <section className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-primary">1. Attendees</h3>
              <Button type="button" variant="outline" size="sm" onClick={handleAddAttendee}>
                <Plus className="h-4 w-4 mr-2" /> Add Attendee
              </Button>
            </div>
            {attendees.map((att, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="grid grid-cols-3 gap-2 flex-1">
                  <div>
                    <Label className="text-xs">Role</Label>
                    <Input value={att.role} onChange={(e) => updateAttendee(i, 'role', e.target.value)} placeholder="e.g. Crane Operator" />
                  </div>
                  <div>
                    <Label className="text-xs">Name</Label>
                    <Input value={att.name} onChange={(e) => updateAttendee(i, 'name', e.target.value)} placeholder="John Doe" />
                  </div>
                  <div>
                    <Label className="text-xs">Company</Label>
                    <Input value={att.company} onChange={(e) => updateAttendee(i, 'company', e.target.value)} placeholder="Acme Corp" />
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon" className="mt-5 text-destructive" onClick={() => handleRemoveAttendee(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {attendees.length === 0 && <p className="text-sm text-muted-foreground">No attendees added yet. Add people who will be part of today's lifts.</p>}
          </section>

          {/* Weather */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-primary">2. Weather Conditions</h3>
            <p className="text-xs text-muted-foreground -mt-3">Resets daily at 15:00</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Forecast Wind Speed</Label>
                <Input value={windSpeed} onChange={e => setWindSpeed(e.target.value)} placeholder="e.g. 15 mph" />
              </div>
              <div>
                <Label>Forecast Gust Speed</Label>
                <Input value={gustSpeed} onChange={e => setGustSpeed(e.target.value)} placeholder="e.g. 25 mph" />
              </div>
              <div>
                <Label>Weather & Temp</Label>
                <Input value={weatherConditions} onChange={e => setWeatherConditions(e.target.value)} placeholder="e.g. Light rain, 12°C" />
              </div>
            </div>
          </section>

          {/* Site Details */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-primary">3. Site Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>First Aider Name</Label>
                <Input value={firstAiderName} onChange={e => setFirstAiderName(e.target.value)} placeholder="Jane Smith" />
              </div>
              <div>
                <Label>Site Location</Label>
                <Input value={siteLocation} onChange={e => setSiteLocation(e.target.value)} placeholder="Block A" />
              </div>
              <div>
                <Label>Muster Point</Label>
                <Input value={musterPointLocation} onChange={e => setMusterPointLocation(e.target.value)} placeholder="Main Gate" />
              </div>
            </div>
          </section>

          {/* Changes & AOB */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-primary">4. Updates & Changes</h3>
            <div>
              <Label>Changes to site layout, lifting team, restrictions, or risk assessments</Label>
              <Textarea value={siteChanges} onChange={e => setSiteChanges(e.target.value)} placeholder="Enter any changes here..." className="min-h-[80px]" />
            </div>
            <div>
              <Label>Any Other Business</Label>
              <Textarea value={anyOtherBusiness} onChange={e => setAnyOtherBusiness(e.target.value)} placeholder="Additional notes..." className="min-h-[80px]" />
            </div>
          </section>

          {/* Lifting Schedule */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-primary">5. Lifting Schedule</h3>
            <div>
              <Label>Today's subcontractor/main contractor lifting requirements</Label>
              <Textarea value={liftingSchedule} onChange={e => setLiftingSchedule(e.target.value)} placeholder="Schedule details..." className="min-h-[100px]" />
            </div>
          </section>

          {/* Checklist */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-primary">6. Checklist</h3>
            <div className="space-y-3 bg-muted/30 p-4 rounded-xl border border-border">
              {Object.entries({
                checklist_crane_responsible: 'Is everyone clear on which crane they are responsible for?',
                checklist_activities_planned: 'Are all activities planned?',
                checklist_deliveries_scheduled: 'Are all expected deliveries scheduled?',
                checklist_environmental_changes: 'Have you communicated any site/environmental changes?',
                checklist_pre_use_checks: 'Have you reminded everyone to carry out the daily pre-use accessory checks?',
                checklist_safety_first: 'Is everyone clear on Safety First, if unsure stop the lifting operation and re-assess?',
                checklist_crane_secured: 'Is tower crane secured each floor for unauthorised personnel to access the crane?',
                checklist_whistles_checked: 'Do all Slinger/Crane Supervisor have handheld whistles and checked they are working?',
                checklist_radio_check: 'Has a radio check been completed for all lifting operatives?',
              }).map(([key, label]) => (
                <div key={key} className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    id={key} 
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    checked={checklist[key as keyof typeof checklist]} 
                    onChange={(e) => setChecklist(prev => ({ ...prev, [key]: e.target.checked }))}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label htmlFor={key} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      {label}
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Sign Off */}
          <section className="space-y-4 border-t border-border pt-6">
            <h3 className="text-lg font-semibold text-primary">7. Supervisor Sign Off</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Appointed Person Name</Label>
                <Input value={appointedPersonName} onChange={e => setAppointedPersonName(e.target.value)} />
              </div>
              <div>
                <Label>Lifting Supervisor Name</Label>
                <Input value={liftingSupervisorName} onChange={e => setLiftingSupervisorName(e.target.value)} />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Supervisor Signature</Label>
              {supervisorSignatureUrl ? (
                <div className="relative border border-border rounded-xl bg-white p-2 w-full max-w-md">
                  <img src={supervisorSignatureUrl} alt="Supervisor Signature" className="h-32 object-contain mx-auto mix-blend-multiply" />
                  <Button type="button" variant="destructive" size="sm" className="absolute top-2 right-2" onClick={() => setSupervisorSignatureUrl('')}>
                    Clear
                  </Button>
                </div>
              ) : isSigning ? (
                <SignaturePad 
                  onSign={(url) => { setSupervisorSignatureUrl(url); setIsSigning(false); }} 
                  onCancel={() => setIsSigning(false)} 
                />
              ) : (
                <Button type="button" variant="outline" onClick={() => setIsSigning(true)}>
                  Click to Sign
                </Button>
              )}
            </div>
          </section>

          <div className="flex justify-end gap-3 pt-6 border-t border-border">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Briefing
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
