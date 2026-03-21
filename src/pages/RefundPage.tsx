import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';

export default function RefundPage() {
  const { t, i18n } = useTranslation();
  const isSr = i18n.language === 'sr';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="container mx-auto px-4 py-8 max-w-3xl flex-1">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Link>

        <h1 className="font-display text-3xl font-bold mb-8">
          {isSr ? 'Politika povraćaja sredstava' : 'Refund Policy'}
        </h1>

        <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground">
          <p className="text-sm">{isSr ? 'Poslednje ažuriranje: mart 2026.' : 'Last updated: March 2026'}</p>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{isSr ? '1. Uvod' : '1. Introduction'}</h2>
            <p>{isSr
              ? 'Ova politika povraćaja sredstava se odnosi na sve pretplate na platformi Quizestro, koju upravlja DARKM SOLUTIONS. Želimo da budete potpuno zadovoljni našom uslugom.'
              : 'This refund policy applies to all subscriptions on the Quizestro platform, operated by DARKM SOLUTIONS. We want you to be completely satisfied with our service.'
            }</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{isSr ? '2. Besplatan probni period' : '2. Free Trial'}</h2>
            <p>{isSr
              ? 'Quizestro nudi 14-dnevni besplatan probni period za Pro plan. Tokom probnog perioda nećete biti naplaćeni. Ako otkažete pre isteka probnog perioda, neće biti nikakve naplate.'
              : 'Quizestro offers a 14-day free trial for the Pro plan. You will not be charged during the trial period. If you cancel before the trial ends, there will be no charge.'
            }</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{isSr ? '3. Otkazivanje pretplate' : '3. Subscription Cancellation'}</h2>
            <p>{isSr
              ? 'Možete otkazati pretplatu u bilo kom trenutku putem podešavanja na platformi. Nakon otkazivanja, zadržavate pristup Pro funkcijama do kraja tekućeg obračunskog perioda. Neće biti daljih naplata nakon otkazivanja.'
              : 'You can cancel your subscription at any time through the platform settings. After cancellation, you retain access to Pro features until the end of your current billing period. There will be no further charges after cancellation.'
            }</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{isSr ? '4. Povraćaj sredstava' : '4. Refunds'}</h2>
            <p>{isSr
              ? 'Povraćaj sredstava je moguć u sledećim slučajevima:'
              : 'Refunds are available in the following cases:'
            }</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>{isSr
                ? 'Ako ste naplaćeni nakon probnog perioda a niste nameravali da nastavite — kontaktirajte nas u roku od 7 dana od naplate.'
                : 'If you were charged after a trial period and did not intend to continue — contact us within 7 days of the charge.'
              }</li>
              <li>{isSr
                ? 'Ako je došlo do tehničke greške ili duplog naplaćivanja.'
                : 'If there was a technical error or duplicate charge.'
              }</li>
              <li>{isSr
                ? 'Ako platforma nije bila dostupna više od 72 sata u obračunskom periodu.'
                : 'If the platform was unavailable for more than 72 hours during your billing period.'
              }</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{isSr ? '5. Kako zatražiti povraćaj' : '5. How to Request a Refund'}</h2>
            <p>{isSr
              ? 'Da biste zatražili povraćaj sredstava, pošaljite zahtev putem kontakt forme na našem sajtu ili na email adresu navedenu na platformi. Molimo navedite vaš email, razlog za povraćaj i datum naplate. Zahtevi se obrađuju u roku od 5-10 radnih dana.'
              : 'To request a refund, send your request via the contact form on our website or to the email address listed on the platform. Please include your email, reason for the refund, and the date of the charge. Requests are processed within 5-10 business days.'
            }</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{isSr ? '6. Izuzeci' : '6. Exceptions'}</h2>
            <p>{isSr
              ? 'Povraćaj sredstava nije moguć u sledećim slučajevima:'
              : 'Refunds are not available in the following cases:'
            }</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>{isSr
                ? 'Ako je prošlo više od 30 dana od naplate.'
                : 'If more than 30 days have passed since the charge.'
              }</li>
              <li>{isSr
                ? 'Ako ste koristili platformu značajno tokom obračunskog perioda.'
                : 'If you have used the platform significantly during the billing period.'
              }</li>
              <li>{isSr
                ? 'Ako je nalog suspendovan zbog kršenja uslova korišćenja.'
                : 'If your account was suspended due to a violation of the terms of service.'
              }</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{isSr ? '7. Kontakt' : '7. Contact'}</h2>
            <p>{isSr
              ? 'Za sva pitanja u vezi sa povraćajem sredstava, kontaktirajte DARKM SOLUTIONS putem kontakt forme na sajtu ili na email adresu navedenu na platformi.'
              : 'For any questions regarding refunds, contact DARKM SOLUTIONS via the contact form on our website or the email address listed on the platform.'
            }</p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
