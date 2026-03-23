import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, XCircle, Loader2, MailX } from 'lucide-react';

type Status = 'loading' | 'valid' | 'already' | 'invalid' | 'success' | 'error';

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<Status>('loading');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`, {
      headers: { apikey: anonKey },
    })
      .then(r => r.json())
      .then(data => {
        if (data.valid === false && data.reason === 'already_unsubscribed') setStatus('already');
        else if (data.valid) setStatus('valid');
        else setStatus('invalid');
      })
      .catch(() => setStatus('error'));
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const { data } = await supabase.functions.invoke('handle-email-unsubscribe', {
        body: { token },
      });
      if (data?.success) setStatus('success');
      else if (data?.reason === 'already_unsubscribed') setStatus('already');
      else setStatus('error');
    } catch { setStatus('error'); }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          {status === 'loading' && (
            <>
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Učitavanje...</p>
            </>
          )}
          {status === 'valid' && (
            <>
              <MailX className="h-10 w-10 mx-auto text-primary" />
              <h1 className="text-xl font-bold">Odjava sa email liste</h1>
              <p className="text-muted-foreground">Da li želite da se odjavite sa email obaveštenja?</p>
              <Button onClick={handleUnsubscribe} disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Potvrdi odjavu
              </Button>
            </>
          )}
          {status === 'success' && (
            <>
              <CheckCircle className="h-10 w-10 mx-auto text-green-500" />
              <h1 className="text-xl font-bold">Uspešno ste se odjavili</h1>
              <p className="text-muted-foreground">Nećete više primati email obaveštenja.</p>
            </>
          )}
          {status === 'already' && (
            <>
              <CheckCircle className="h-10 w-10 mx-auto text-muted-foreground" />
              <h1 className="text-xl font-bold">Već ste odjavljeni</h1>
              <p className="text-muted-foreground">Vaša email adresa je već odjavljena sa email liste.</p>
            </>
          )}
          {status === 'invalid' && (
            <>
              <XCircle className="h-10 w-10 mx-auto text-destructive" />
              <h1 className="text-xl font-bold">Nevažeći link</h1>
              <p className="text-muted-foreground">Ovaj link za odjavu nije validan ili je istekao.</p>
            </>
          )}
          {status === 'error' && (
            <>
              <XCircle className="h-10 w-10 mx-auto text-destructive" />
              <h1 className="text-xl font-bold">Greška</h1>
              <p className="text-muted-foreground">Došlo je do greške. Pokušajte ponovo kasnije.</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
