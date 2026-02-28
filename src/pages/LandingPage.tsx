import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Trophy, Users, BarChart3, Zap, HelpCircle, Share2, Check, ArrowRight } from 'lucide-react';
import heroBg from '@/assets/hero-bg.jpg';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' as const },
  }),
};

export default function LandingPage() {
  const { t } = useTranslation();

  const features = [
    { icon: Zap, key: 'liveScoring' },
    { icon: Users, key: 'teams' },
    { icon: Trophy, key: 'leagues' },
    { icon: BarChart3, key: 'stats' },
    { icon: HelpCircle, key: 'helps' },
    { icon: Share2, key: 'export' },
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
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6"
          >
            <Trophy className="h-4 w-4" />
            {t('hero.badge')}
          </motion.div>
          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
            className="font-display text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight max-w-4xl mx-auto leading-tight"
          >
            {t('hero.title')}
          </motion.h1>
          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
            className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto"
          >
            {t('hero.subtitle')}
          </motion.p>
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={3}
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

      {/* Features */}
      <section id="features" className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold">{t('features.title')}</h2>
            <p className="mt-4 text-muted-foreground text-lg">{t('features.subtitle')}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.key}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-50px' }}
                variants={fadeUp}
                custom={i}
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

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold">{t('pricing.title')}</h2>
            <p className="mt-4 text-muted-foreground text-lg">{t('pricing.subtitle')}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={0}
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
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={1}
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
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={2}
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

      <Footer />
    </div>
  );
}
