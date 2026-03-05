import { Link } from 'react-router-dom';
import { CircleSlash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

export default function BillingCancelPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center">
          <CircleSlash2 className="h-7 w-7 text-amber-500" />
        </div>

        <h1 className="font-display text-2xl font-bold">Checkout canceled</h1>
        <p className="text-sm text-muted-foreground">
          No payment was processed. You can return to billing and try again at any time.
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
