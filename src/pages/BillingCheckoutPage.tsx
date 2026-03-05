import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PADDLE_JS_URL = 'https://cdn.paddle.com/paddle/v2/paddle.js';

declare global {
  interface Window {
    Paddle?: {
      Environment: { set: (environment: 'sandbox' | 'production') => void };
      Initialize: (config: { token: string; eventCallback?: (event: { name?: string }) => void }) => void;
      Checkout: { open: (config: { transactionId: string; settings?: Record<string, unknown> }) => void };
    };
  }
}

export default function BillingCheckoutPage() {
  const [error, setError] = useState<string | null>(null);
  const transactionId = useMemo(() => {
    const search = new URLSearchParams(window.location.search);
    return (
      search.get('transaction_id') ||
      search.get('txn') ||
      search.get('paddle_transaction_id') ||
      ''
    );
  }, []);

  useEffect(() => {
    let redirectTimer: number | undefined;
    let attemptedOpen = false;
    let redirected = false;
    const redirectToCancel = (reason: string) => {
      if (redirected) return;
      redirected = true;
      const url = new URL('/billing/cancel', window.location.origin);
      url.searchParams.set('reason', reason);
      window.location.href = url.toString();
    };

    const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined;
    const paddleEnv = (import.meta.env.VITE_PADDLE_ENVIRONMENT as 'sandbox' | 'production' | undefined) || 'sandbox';

    if (!token) {
      setError('Missing VITE_PADDLE_CLIENT_TOKEN.');
      redirectTimer = window.setTimeout(() => redirectToCancel('missing_token'), 1200);
      return;
    }
    if (!transactionId) {
      setError('Missing transaction id.');
      redirectTimer = window.setTimeout(() => redirectToCancel('missing_transaction'), 1200);
      return;
    }

    const openCheckout = () => {
      if (!window.Paddle) {
        setError('Paddle failed to load.');
        redirectToCancel('paddle_not_loaded');
        return;
      }
      window.Paddle.Environment.set(paddleEnv);
      window.Paddle.Initialize({
        token,
        eventCallback: (event) => {
          if (event?.name === 'checkout.closed') {
            redirectToCancel('checkout_closed');
          }
        },
      });
      attemptedOpen = true;
      window.Paddle.Checkout.open({
        transactionId,
        settings: {
          displayMode: 'overlay',
          successUrl: `${window.location.origin}/billing/success`,
        },
      });
    };

    const existing = document.querySelector(`script[src="${PADDLE_JS_URL}"]`) as HTMLScriptElement | null;
    if (existing) {
      if ((existing as any)._paddleLoaded) {
        openCheckout();
      } else {
        existing.addEventListener('load', openCheckout, { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = PADDLE_JS_URL;
    script.async = true;
    script.addEventListener('load', () => {
      (script as any)._paddleLoaded = true;
      openCheckout();
    });
    script.addEventListener('error', () => {
      setError('Failed to load Paddle script.');
      redirectToCancel('script_load_failed');
    });
    document.body.appendChild(script);

    redirectTimer = window.setTimeout(() => {
      if (!attemptedOpen) {
        setError('Checkout did not open in time.');
        redirectToCancel('open_timeout');
      }
    }, 10000);

    return () => {
      if (redirectTimer) window.clearTimeout(redirectTimer);
    };
  }, [transactionId]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center space-y-4">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <Loader2 className="h-7 w-7 animate-spin mx-auto text-primary" />
        )}
        <h1 className="font-display text-2xl font-bold">Opening secure checkout</h1>
        <p className="text-sm text-muted-foreground">
          If checkout does not open automatically, verify Paddle client token, environment, and approved website settings.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link to="/dashboard/pricing">Back to billing</Link>
        </Button>
      </div>
    </div>
  );
}
