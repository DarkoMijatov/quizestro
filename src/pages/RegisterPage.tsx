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
import { Checkbox } from '@/components/ui/checkbox';

export default function RegisterPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/onboarding`,
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✓', description: 'Check your email to verify your account.' });
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-dark items-center justify-center p-12">
        <div className="text-center">
          <img src="/logo.png" alt="Quizestro" className="h-16 w-16 mx-auto mb-6 brand-logo" />
          <h1 className="font-display text-4xl font-bold text-foreground">Quizestro</h1>
          <p className="mt-4 text-muted-foreground max-w-sm">{t('hero.subtitle')}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex justify-between items-center p-4">
          <Link to="/" className="flex items-center gap-2 font-display font-bold lg:hidden">
            <img src="/logo.png" alt="Quizestro" className="h-6 w-6 brand-logo" />
            Quizestro
          </Link>
          <LanguageSwitcher variant="ghost" />
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-sm space-y-6">
            <h2 className="font-display text-2xl font-bold">{t('auth.register')}</h2>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('auth.fullName')}</Label>
                <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">{t('auth.confirmPassword')}</Label>
                <Input id="confirm" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="terms"
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="terms" className="text-sm font-normal leading-snug cursor-pointer">
                  {t('auth.acceptTerms')}{' '}
                  <a href="/terms" target="_blank" className="text-primary hover:underline">{t('auth.termsOfService')}</a>
                  {' '}{t('common.and')}{' '}
                  <a href="/privacy" target="_blank" className="text-primary hover:underline">{t('auth.privacyPolicy')}</a>
                </Label>
              </div>
              <Button type="submit" className="w-full" disabled={loading || !acceptedTerms}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('auth.registerCta')}
              </Button>
            </form>
            <p className="text-sm text-center text-muted-foreground">
              {t('auth.hasAccount')}{' '}
              <Link to="/login" className="text-primary hover:underline font-medium">
                {t('auth.login')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
