import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

function parseParamsFromHashAndSearch() {
  const hash = window.location.hash?.replace(/^#/, '') ?? '';
  const search = window.location.search?.replace(/^\?/, '') ?? '';
  const hashParams = new URLSearchParams(hash);
  const searchParams = new URLSearchParams(search);

  const get = (key: string) => hashParams.get(key) ?? searchParams.get(key) ?? '';

  return {
    error: get('error'),
    errorCode: get('error_code'),
    errorDescription: get('error_description'),
    type: get('type'),
  };
}

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Verifikacija naloga je u toku...');

  const params = useMemo(() => parseParamsFromHashAndSearch(), []);

  useEffect(() => {
    const run = async () => {
      try {
        if (params.error) {
          const isExpired = params.errorCode === 'otp_expired';
          setMessage(
            isExpired
              ? 'Link za potvrdu je istekao ili je već iskorišćen. Zatražite novi verifikacioni email i pokušajte ponovo.'
              : decodeURIComponent(params.errorDescription || params.error)
          );
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) {
          setMessage(error.message);
          setLoading(false);
          return;
        }

        if (data.session) {
          setMessage('Nalog je uspešno potvrđen. Preusmeravanje...');
          setTimeout(() => navigate('/onboarding', { replace: true }), 1200);
          return;
        }

        setMessage('Verifikacija je završena. Ulogujte se da nastavite.');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [navigate, params.error, params.errorCode, params.errorDescription]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-lg border bg-card p-6 text-center space-y-4">
        <h1 className="text-xl font-semibold">Auth callback</h1>
        <p className="text-sm text-muted-foreground">{message}</p>

        {loading && (
          <div className="flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {!loading && (
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => navigate('/login', { replace: true })}>
              Idi na login
            </Button>
            <Button onClick={() => navigate('/register', { replace: true })}>Registruj se ponovo</Button>
          </div>
        )}
      </div>
    </div>
  );
}
