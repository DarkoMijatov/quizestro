import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-dark items-center justify-center p-12">
        <div className="text-center">
          <Trophy className="h-16 w-16 text-primary mx-auto mb-6" />
          <h1 className="font-display text-4xl font-bold text-foreground">Quizestro</h1>
          <p className="mt-4 text-muted-foreground max-w-sm">{t('hero.subtitle')}</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col">
        <div className="flex justify-between items-center p-4">
          <Link to="/" className="flex items-center gap-2 font-display font-bold lg:hidden">
            <Trophy className="h-5 w-5 text-primary" />
            Quizestro
          </Link>
          <LanguageSwitcher variant="ghost" />
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-sm space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold">{t('auth.login')}</h2>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="password">{t('auth.password')}</Label>
                  <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                    {t('auth.forgotPassword')}
                  </Link>
                </div>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('auth.loginCta')}
              </Button>
            </form>
            <p className="text-sm text-center text-muted-foreground">
              {t('auth.noAccount')}{' '}
              <Link to="/register" className="text-primary hover:underline font-medium">
                {t('auth.register')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
