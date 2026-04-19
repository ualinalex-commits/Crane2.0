import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

interface SignBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  briefingId: string;
  onSuccess: () => void;
}

export function SignBriefingModal({ isOpen, onClose, briefingId, onSuccess }: SignBriefingModalProps) {
  const { profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getRoleLabel = (role: string) => {
    return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const handleSign = async (signatureDataUrl: string) => {
    if (!profile) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('briefing_signatures').insert({
        briefing_id: briefingId,
        user_id: profile.user_id,
        name: profile.full_name,
        company: profile.company?.name || profile.subcontractor_company_name || 'Unknown',
        role: getRoleLabel(profile.role),
        signature_image_url: signatureDataUrl,
      });

      if (error) throw error;

      alert('Briefing signed successfully.');
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to sign briefing.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!profile) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Sign Daily Briefing</DialogTitle>
          <DialogDescription>
            Please confirm your details and provide your signature.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Name</p>
              <p className="text-base font-semibold">{profile.full_name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Role</p>
              <p className="text-base font-semibold">{getRoleLabel(profile.role)}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm font-medium text-muted-foreground">Company</p>
              <p className="text-base font-semibold">{profile.company?.name || profile.subcontractor_company_name || 'N/A'}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Signature</p>
            {isSubmitting ? (
              <div className="h-48 border border-border rounded-xl bg-muted flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <SignaturePad onSign={handleSign} onCancel={onClose} />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
