import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SEOHead } from '@/components/SEOHead';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setSent(true);
    }
  };

  return (
    <>
    <SEOHead titleKey="auth.forgotPassword" descriptionFallback="Reset your Quizestro password." noIndex />
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2 font-display font-bold">
            <img src="/logo.png" alt="Quizestro" className="h-6 w-6 brand-logo" />
            Quizestro
          </Link>
          <LanguageSwitcher variant="ghost" />
        </div>
        <h2 className="font-display text-2xl font-bold">{t('auth.resetPassword')}</h2>
        {sent ? (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">{t('auth.resetSuccess')}</p>
            <Link to="/login">
              <Button variant="outline" className="w-full">{t('auth.backToLogin')}</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('auth.resetCta')}
            </Button>
            <Link to="/login" className="block text-sm text-center text-primary hover:underline">
              {t('auth.backToLogin')}
            </Link>
          </form>
        )}
      </div>
    </div>
    </>
  );
}
