import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

export default function BillingSuccessPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle2 className="h-7 w-7 text-emerald-500" />
        </div>

        <h1 className="font-display text-2xl font-bold">Payment successful</h1>
        <p className="text-sm text-muted-foreground">
          Your checkout was completed. Subscription updates can take a moment while the webhook is processed.
        </p>

        {user ? (
          <Button asChild className="w-full">
            <Link to="/dashboard/pricing">Back to billing</Link>
          </Button>
        ) : (
          <Button asChild className="w-full">
            <Link to="/login">Go to login</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
