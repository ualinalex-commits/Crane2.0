import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { FileText, CheckCircle2, FileSignature, Loader2 } from 'lucide-react';
import { SetUpBriefingModal } from './SetUpBriefingModal';
import { SignBriefingModal } from './SignBriefingModal';
import type { DailyBriefing, BriefingSignature } from '@/types';
import { format } from 'date-fns';

export function DailyBriefingPage() {
  const { profile } = useAuth();
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [pastBriefing, setPastBriefing] = useState<DailyBriefing | null>(null);
  const [signatures, setSignatures] = useState<BriefingSignature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isSetUpModalOpen, setIsSetUpModalOpen] = useState(false);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchBriefing = async () => {
    if (!profile?.site_id) return;
    setIsLoading(true);

    try {
      // Get today's briefing
      const { data, error } = await supabase
        .from('daily_briefings')
        .select('*')
        .eq('site_id', profile.site_id)
        .eq('date', todayStr)
        .maybeSingle();

      if (error) throw error;
      setBriefing(data);

      if (data) {
        // Fetch signatures for today's briefing
        const { data: sigs, error: sigError } = await supabase
          .from('briefing_signatures')
          .select('*')
          .eq('briefing_id', data.id);
        
        if (sigError) throw sigError;
        setSignatures(sigs || []);
      } else {
        // If no briefing today, fetch the most recent one to prefill
        const { data: past, error: pastError } = await supabase
          .from('daily_briefings')
          .select('*')
          .eq('site_id', profile.site_id)
          .lt('date', todayStr)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (!pastError && past) {
          setPastBriefing(past);
        }
      }
    } catch (err) {
      console.error('Error fetching briefing:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBriefing();
  }, [profile?.site_id]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const canSetUp = profile?.role === 'appointed_person' || profile?.role === 'crane_supervisor' || profile?.role === 'admin';
  const hasSigned = signatures.some(s => s.user_id === profile?.user_id);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-6 rounded-2xl shadow-sm border border-border">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Daily Briefing</h1>
          <p className="text-muted-foreground mt-1">{format(new Date(), 'EEEE, do MMMM yyyy')}</p>
        </div>
        
        <div className="flex items-center gap-3">
          {canSetUp ? (
            <Button onClick={() => setIsSetUpModalOpen(true)} className="gap-2">
              <FileText className="h-4 w-4" />
              {briefing ? 'Edit Briefing' : 'Set Up Briefing'}
            </Button>
          ) : briefing ? (
            hasSigned ? (
              <Button disabled variant="outline" className="gap-2 text-green-600 border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4" />
                Signed
              </Button>
            ) : (
              <Button onClick={() => setIsSignModalOpen(true)} className="gap-2">
                <FileSignature className="h-4 w-4" />
                Sign Briefing
              </Button>
            )
          ) : null}
        </div>
      </div>

      {/* Briefing Document View */}
      {briefing ? (
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="bg-primary/5 px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Lifting Operations Daily Briefing
            </h2>
          </div>
          
          <div className="p-6 space-y-8">
            
            {/* 1. Attendees */}
            <section>
              <h3 className="text-base font-bold text-foreground border-b border-border pb-2 mb-4">1. Attendees</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium rounded-tl-xl">Role</th>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Company</th>
                      <th className="px-4 py-3 font-medium rounded-tr-xl text-center">Signature</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {signatures.map((sig, i) => (
                      <tr key={i} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 font-medium">{sig.role}</td>
                        <td className="px-4 py-3">{sig.name}</td>
                        <td className="px-4 py-3">{sig.company}</td>
                        <td className="px-4 py-2 text-center">
                          <img src={sig.signature_image_url} alt="Signature" className="h-10 object-contain mx-auto mix-blend-multiply" />
                        </td>
                      </tr>
                    ))}
                    {signatures.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-4 text-center text-muted-foreground">No signatures yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 2. Weather & 3. Site Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <section>
                <h3 className="text-base font-bold text-foreground border-b border-border pb-2 mb-4">2. Weather Conditions</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <dt className="text-muted-foreground">Forecast Wind Speed</dt>
                    <dd className="font-medium">{briefing.wind_speed || 'N/A'}</dd>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <dt className="text-muted-foreground">Forecast Gust Speed</dt>
                    <dd className="font-medium">{briefing.gust_speed || 'N/A'}</dd>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <dt className="text-muted-foreground">Conditions</dt>
                    <dd className="font-medium">{briefing.weather_conditions || 'N/A'}</dd>
                  </div>
                </dl>
              </section>

              <section>
                <h3 className="text-base font-bold text-foreground border-b border-border pb-2 mb-4">3. Site Details</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <dt className="text-muted-foreground">First Aider</dt>
                    <dd className="font-medium">{briefing.first_aider_name || 'N/A'}</dd>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <dt className="text-muted-foreground">Site Location</dt>
                    <dd className="font-medium">{briefing.site_location || 'N/A'}</dd>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <dt className="text-muted-foreground">Muster Point</dt>
                    <dd className="font-medium">{briefing.muster_point_location || 'N/A'}</dd>
                  </div>
                </dl>
              </section>
            </div>

            {/* 4. Updates & 5. Schedule */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <section className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-foreground border-b border-border pb-2 mb-4">4. Updates & Changes</h3>
                  <div className="bg-muted/30 p-4 rounded-xl min-h-[80px] text-sm whitespace-pre-wrap">
                    {briefing.site_changes || <span className="text-muted-foreground italic">No changes reported.</span>}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-2">Any Other Business</h3>
                  <div className="bg-muted/30 p-4 rounded-xl min-h-[80px] text-sm whitespace-pre-wrap">
                    {briefing.any_other_business || <span className="text-muted-foreground italic">None.</span>}
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-base font-bold text-foreground border-b border-border pb-2 mb-4">5. Lifting Schedule</h3>
                <div className="bg-muted/30 p-4 rounded-xl h-[calc(100%-2.5rem)] text-sm whitespace-pre-wrap">
                  {briefing.lifting_schedule || <span className="text-muted-foreground italic">No lifting schedule provided.</span>}
                </div>
              </section>
            </div>

            {/* 6. Checklist */}
            <section>
              <h3 className="text-base font-bold text-foreground border-b border-border pb-2 mb-4">6. Checklist</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {[
                  { key: 'checklist_crane_responsible', label: 'Clear on responsible crane?' },
                  { key: 'checklist_activities_planned', label: 'All activities planned?' },
                  { key: 'checklist_deliveries_scheduled', label: 'Deliveries scheduled?' },
                  { key: 'checklist_environmental_changes', label: 'Environmental changes communicated?' },
                  { key: 'checklist_pre_use_checks', label: 'Pre-use checks reminded?' },
                  { key: 'checklist_safety_first', label: 'Safety First clear?' },
                  { key: 'checklist_crane_secured', label: 'Crane secured each floor?' },
                  { key: 'checklist_whistles_checked', label: 'Whistles checked?' },
                  { key: 'checklist_radio_check', label: 'Radio check completed?' },
                ].map((item) => (
                  <div key={item.key} className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {(briefing as any)[item.key] ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-muted-foreground/30 bg-muted/50" />
                      )}
                    </div>
                    <span className={(briefing as any)[item.key] ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* 7. Sign Off */}
            <section className="bg-muted/30 p-6 rounded-2xl border border-border">
              <h3 className="text-base font-bold text-foreground mb-4">7. Supervisor Sign Off</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Appointed Person</p>
                  <p className="font-semibold">{briefing.appointed_person_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Lifting Supervisor</p>
                  <p className="font-semibold">{briefing.lifting_supervisor_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Signature</p>
                  {briefing.supervisor_signature_url ? (
                    <img src={briefing.supervisor_signature_url} alt="Supervisor Signature" className="h-16 object-contain mix-blend-multiply" />
                  ) : (
                    <span className="text-muted-foreground italic text-sm">Not signed</span>
                  )}
                </div>
              </div>
            </section>

            {/* Bottom Signature Action for Operatives */}
            {!canSetUp && !hasSigned && (
              <div className="pt-8 flex justify-center">
                <Button size="lg" onClick={() => setIsSignModalOpen(true)} className="gap-2 px-8">
                  <FileSignature className="h-5 w-5" />
                  Sign Briefing
                </Button>
              </div>
            )}
            
            {!canSetUp && hasSigned && (
              <div className="pt-8 flex justify-center">
                <Button disabled variant="outline" size="lg" className="gap-2 px-8 text-green-600 border-green-200 bg-green-50">
                  <CheckCircle2 className="h-5 w-5" />
                  You have signed today's briefing
                </Button>
              </div>
            )}

          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-card rounded-2xl border border-border border-dashed">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <FileText className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">No Briefing Today</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            The daily briefing for today hasn't been set up yet. {canSetUp && "Click the button below to create it."}
          </p>
          {canSetUp && (
            <Button onClick={() => setIsSetUpModalOpen(true)}>
              <FileText className="mr-2 h-4 w-4" />
              Set Up Briefing
            </Button>
          )}
        </div>
      )}

      {/* Modals */}
      <SetUpBriefingModal
        isOpen={isSetUpModalOpen}
        onClose={() => setIsSetUpModalOpen(false)}
        onSuccess={fetchBriefing}
        existingBriefing={briefing}
        pastBriefing={pastBriefing}
      />

      {briefing && (
        <SignBriefingModal
          isOpen={isSignModalOpen}
          onClose={() => setIsSignModalOpen(false)}
          onSuccess={fetchBriefing}
          briefingId={briefing.id}
        />
      )}
    </div>
  );
}
