import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { CookieBanner } from '@/components/CookieBanner';
import { PublicQuizMap } from '@/components/map/PublicQuizMap';
import { Users, BarChart3, Zap, Share2, Check, ArrowRight, Trophy, UserPlus, FolderOpen, PlayCircle, TrendingUp, Send, Loader2, MessageCircle, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import heroBg from '@/assets/hero-bg.jpg';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' as const },
  }),
};

interface FaqItem {
  id: string;
  question_sr: string;
  question_en: string;
  answer_sr: string;
  answer_en: string;
  sort_order: number;
}

export default function LandingPage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const lang = i18n.language;

  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase
      .from('faq_items')
      .select('*')
      .eq('is_published', true)
      .order('sort_order')
      .then(({ data }) => {
        if (data) setFaqItems(data as FaqItem[]);
      });
  }, []);

  const handleContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim() || !contactForm.email.trim() || !contactForm.message.trim()) return;
    setSending(true);
    const { error } = await supabase.from('contact_submissions').insert({
      name: contactForm.name.trim(),
      email: contactForm.email.trim(),
      message: contactForm.message.trim(),
    });
    setSending(false);
    if (error) {
      toast({ title: '✗', description: t('landing.contactError'), variant: 'destructive' });
    } else {
      toast({ title: '✓', description: t('landing.contactSuccess') });
      setContactForm({ name: '', email: '', message: '' });
    }
  };

  const features = [
    { icon: Zap, key: 'liveScoring' },
    { icon: Users, key: 'teams' },
    { icon: Trophy, key: 'leagues' },
    { icon: BarChart3, key: 'stats' },
    { icon: Share2, key: 'export' },
    { icon: BookOpen, key: 'questionBank' },
  ];

  const steps = [
    { icon: UserPlus, key: 'step1' },
    { icon: FolderOpen, key: 'step2' },
    { icon: PlayCircle, key: 'step3' },
    { icon: TrendingUp, key: 'step4' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-16 overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroBg} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/80 to-background" />
        </div>
        <div className="relative container mx-auto px-4 py-24 md:py-40 text-center">
          <motion.div
            initial="hidden" animate="visible" variants={fadeUp} custom={0}
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6"
          >
            <img src="/logo.png" alt="" className="h-5 w-5 brand-logo" />
            {t('hero.badge')}
          </motion.div>
          <motion.h1 initial="hidden" animate="visible" variants={fadeUp} custom={1}
            className="font-display text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight max-w-4xl mx-auto leading-tight"
          >
            {t('hero.title')}
          </motion.h1>
          <motion.p initial="hidden" animate="visible" variants={fadeUp} custom={2}
            className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto"
          >
            {t('hero.subtitle')}
          </motion.p>
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3}
            className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link to="/register">
              <Button size="lg" className="text-base px-8 gap-2">
                {t('hero.cta')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Public Quiz Map */}
      <PublicQuizMap />

      {/* Features */}
      <section id="features" className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold">{t('features.title')}</h2>
            <p className="mt-4 text-muted-foreground text-lg">{t('features.subtitle')}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div key={f.key} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={fadeUp} custom={i}
                className="group rounded-xl border border-border bg-card p-6 hover:shadow-lg hover:border-primary/30 transition-all duration-300"
              >
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-lg bg-primary/10 text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{t(`features.${f.key}.title`)}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{t(`features.${f.key}.description`)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="instructions" className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold">{t('landing.instructionsTitle')}</h2>
            <p className="mt-4 text-muted-foreground text-lg">{t('landing.instructionsSubtitle')}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
            {steps.map((s, i) => (
              <motion.div key={s.key} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={fadeUp} custom={i}
                className="text-center"
              >
                <div className="relative inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 text-primary mb-5 mx-auto">
                  <s.icon className="h-7 w-7" />
                  <span className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{t(`landing.${s.key}Title`)}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{t(`landing.${s.key}Desc`)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold">{t('pricing.title')}</h2>
            <p className="mt-4 text-muted-foreground text-lg">{t('pricing.subtitle')}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
              className="rounded-xl border border-border bg-card p-8"
            >
              <h3 className="font-display text-xl font-bold">{t('pricing.free.name')}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold font-display">{t('pricing.free.priceDisplay', '€0')}</span>
                <span className="text-muted-foreground">{t('pricing.free.period')}</span>
              </div>
              <ul className="mt-8 space-y-3">
                {(t('pricing.free.features', { returnObjects: true }) as string[]).map((feat, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>
              <Link to="/register" className="block mt-8">
                <Button variant="outline" className="w-full">{t('pricing.free.cta')}</Button>
              </Link>
            </motion.div>

            {/* Pro Monthly */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
              className="rounded-xl border-2 border-primary bg-card p-8 relative shadow-gold"
            >
              <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                {t('pricing.premium.popular')}
              </span>
              <h3 className="font-display text-xl font-bold">{t('pricing.premium.name')}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold font-display">{t('pricing.premium.priceDisplay', '€9.99')}</span>
                <span className="text-muted-foreground">/{t('pricing.month')}</span>
              </div>
              <ul className="mt-8 space-y-3">
                {(t('pricing.premium.features', { returnObjects: true }) as string[]).map((feat, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>
              <Link to="/register" className="block mt-8">
                <Button className="w-full">{t('pricing.premium.cta')}</Button>
              </Link>
              <p className="text-xs text-muted-foreground text-center mt-3">{t('pricing.trial')}</p>
            </motion.div>

            {/* Pro Annual */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={2}
              className="rounded-xl border border-border bg-card p-8 relative"
            >
              <span className="absolute -top-3 right-4 rounded-full bg-secondary px-3 py-0.5 text-xs font-semibold text-secondary-foreground">
                {t('pricing.save2months')}
              </span>
              <h3 className="font-display text-xl font-bold">{t('pricing.annual.name')}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold font-display">{t('pricing.annual.priceDisplay', '€99')}</span>
                <span className="text-muted-foreground">/{t('pricing.year')}</span>
              </div>
              <ul className="mt-8 space-y-3">
                {(t('pricing.premium.features', { returnObjects: true }) as string[]).map((feat, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>
              <Link to="/register" className="block mt-8">
                <Button variant="outline" className="w-full">{t('pricing.premium.cta')}</Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold">{t('landing.faqTitle')}</h2>
            <p className="mt-4 text-muted-foreground text-lg">{t('landing.faqSubtitle')}</p>
          </div>
          <div className="max-w-3xl mx-auto">
            {faqItems.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-12 text-center">
                <MessageCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">{t('landing.noFaq')}</p>
              </div>
            ) : (
              <Accordion type="single" collapsible className="space-y-3">
                {faqItems.map((item, i) => (
                  <motion.div key={item.id} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
                    <AccordionItem value={item.id} className="rounded-xl border border-border bg-card px-6 data-[state=open]:border-primary/30">
                      <AccordionTrigger className="text-left font-medium hover:no-underline">
                        {lang === 'sr' ? item.question_sr : item.question_en}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground leading-relaxed">
                        {lang === 'sr' ? item.answer_sr : item.answer_en}
                      </AccordionContent>
                    </AccordionItem>
                  </motion.div>
                ))}
              </Accordion>
            )}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold">{t('landing.contactTitle')}</h2>
            <p className="mt-4 text-muted-foreground text-lg">{t('landing.contactSubtitle')}</p>
          </div>
          <motion.form
            onSubmit={handleContact}
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
            className="max-w-lg mx-auto space-y-4"
          >
            <Input
              placeholder={t('landing.contactName')}
              value={contactForm.name}
              onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
              required
              maxLength={100}
            />
            <Input
              type="email"
              placeholder={t('landing.contactEmail')}
              value={contactForm.email}
              onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
              required
              maxLength={255}
            />
            <Textarea
              placeholder={t('landing.contactMessage')}
              value={contactForm.message}
              onChange={(e) => setContactForm(prev => ({ ...prev, message: e.target.value }))}
              required
              maxLength={1000}
              rows={5}
            />
            <Button type="submit" className="w-full gap-2" disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t('landing.contactSend')}
            </Button>
          </motion.form>
        </div>
      </section>

      <Footer />
      <CookieBanner />
    </div>
  );
}
