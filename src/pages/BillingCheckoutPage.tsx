import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PADDLE_JS_URL = 'https://cdn.paddle.com/paddle/v2/paddle.js';

export default function BillingCheckoutPage() {
  useEffect(() => {
    const existing = document.querySelector(`script[src="${PADDLE_JS_URL}"]`);
    if (existing) return;

    const script = document.createElement('script');
    script.src = PADDLE_JS_URL;
    script.async = true;
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center space-y-4">
        <Loader2 className="h-7 w-7 animate-spin mx-auto text-primary" />
        <h1 className="font-display text-2xl font-bold">Opening secure checkout</h1>
        <p className="text-sm text-muted-foreground">
          If checkout does not open automatically, verify your Paddle default payment link and approved website settings.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link to="/dashboard/pricing">Back to billing</Link>
        </Button>
      </div>
    </div>
  );
}
