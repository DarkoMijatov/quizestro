import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Cookie } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const COOKIE_KEY = 'quizestro-cookie-consent';

export function CookieBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_KEY);
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_KEY, 'accepted');
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem(COOKIE_KEY, 'declined');
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-lg"
        >
          <div className="rounded-2xl border border-border bg-card/95 backdrop-blur-xl p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="shrink-0 h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Cookie className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t('cookies.message')}{' '}
                  <Link to="/privacy" className="text-primary hover:underline">
                    {t('cookies.learnMore')}
                  </Link>
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAccept}>
                    {t('cookies.accept')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleDecline}>
                    {t('cookies.decline')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
