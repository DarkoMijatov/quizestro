import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Footer } from '@/components/Footer';

export default function TermsPage() {
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
          {isSr ? 'Uslovi korišćenja' : 'Terms of Service'}
        </h1>

        <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground">
          <p className="text-sm">{isSr ? 'Poslednje ažuriranje: mart 2026.' : 'Last updated: March 2026'}</p>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{isSr ? '1. Prihvatanje uslova' : '1. Acceptance of Terms'}</h2>
            <p>{isSr
              ? 'Quizestro platforma je u vlasništvu i pod upravljanjem kompanije DARKM SOLUTIONS. Korišćenjem platforme Quizestro prihvatate ove uslove korišćenja u celosti. Ako se ne slažete sa bilo kojim delom ovih uslova, molimo vas da ne koristite platformu.'
              : 'The Quizestro platform is owned and operated by DARKM SOLUTIONS. By using the Quizestro platform, you accept these terms of service in their entirety. If you do not agree with any part of these terms, please do not use the platform.'
            }</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{isSr ? '2. Opis usluge' : '2. Description of Service'}</h2>
            <p>{isSr
              ? 'Quizestro je platforma za organizovanje i upravljanje kvizovima, timovima i ligama. Omogućava korisnicima da kreiraju organizacije, dodaju timove, prave kvizove i prate statistiku.'
              : 'Quizestro is a platform for organizing and managing quizzes, teams, and leagues. It allows users to create organizations, add teams, build quizzes, and track statistics.'
            }</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{isSr ? '3. Korisnički nalog' : '3. User Account'}</h2>
            <p>{isSr
              ? 'Za korišćenje platforme potrebno je da kreirate nalog sa validnom email adresom. Vi ste odgovorni za čuvanje bezbednosti vašeg naloga i lozinke. Nije dozvoljeno deljenje naloga sa drugim licima.'
              : 'To use the platform, you need to create an account with a valid email address. You are responsible for maintaining the security of your account and password. Sharing your account with others is not permitted.'
            }</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{isSr ? '4. Prihvatljivo korišćenje' : '4. Acceptable Use'}</h2>
            <p>{isSr ? 'Slažete se da nećete:' : 'You agree not to:'}</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>{isSr ? 'Koristiti platformu za nezakonite aktivnosti' : 'Use the platform for illegal activities'}</li>
              <li>{isSr ? 'Pokušavati da pristupite tuđim nalozima ili podacima' : 'Attempt to access other users\' accounts or data'}</li>
              <li>{isSr ? 'Ometati rad platforme ili njenu infrastrukturu' : 'Disrupt the operation of the platform or its infrastructure'}</li>
              <li>{isSr ? 'Koristiti automatizovane sisteme za pristup bez dozvole' : 'Use automated systems to access the platform without permission'}</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{isSr ? '5. Pretplate i plaćanja' : '5. Subscriptions and Payments'}</h2>
            <p>{isSr
              ? 'Quizestro nudi besplatan i premium plan. Premium pretplate se naplaćuju mesečno ili godišnje. Možete otkazati pretplatu u bilo kom trenutku, a pristup premium funkcijama ostaje do kraja obračunskog perioda.'
              : 'Quizestro offers free and premium plans. Premium subscriptions are billed monthly or annually. You can cancel your subscription at any time, and access to premium features will remain until the end of the billing period.'
            }</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{isSr ? '6. Intelektualna svojina' : '6. Intellectual Property'}</h2>
            <p>{isSr
              ? 'Sav sadržaj i softver na platformi Quizestro je zaštićen autorskim pravima. Zadržavate vlasništvo nad podacima koje unesete na platformu, ali nam dajete licencu da ih koristimo u svrhu pružanja usluge.'
              : 'All content and software on the Quizestro platform is protected by copyright. You retain ownership of the data you enter on the platform, but grant us a license to use it for the purpose of providing the service.'
            }</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{isSr ? '7. Ograničenje odgovornosti' : '7. Limitation of Liability'}</h2>
            <p>{isSr
              ? 'Quizestro se pruža "kao što jeste" bez ikakvih garancija. Ne snosimo odgovornost za gubitak podataka, prekid usluge ili bilo kakvu štetu nastalu korišćenjem platforme.'
              : 'Quizestro is provided "as is" without any warranties. We are not liable for data loss, service interruptions, or any damages arising from use of the platform.'
            }</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{isSr ? '8. Izmene uslova' : '8. Changes to Terms'}</h2>
            <p>{isSr
              ? 'Zadržavamo pravo da izmenimo ove uslove u bilo kom trenutku. O značajnim promenama ćemo vas obavestiti putem emaila ili obaveštenja na platformi.'
              : 'We reserve the right to modify these terms at any time. We will notify you of significant changes via email or platform notification.'
            }</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{isSr ? '9. Kontakt' : '9. Contact'}</h2>
            <p>{isSr
              ? 'Za sva pitanja u vezi sa ovim uslovima, kontaktirajte DARKM SOLUTIONS putem kontakt forme na sajtu ili na email adresu navedenu na platformi.'
              : 'For any questions regarding these terms, contact DARKM SOLUTIONS via the contact form on our website or the email address listed on the platform.'
            }</p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
