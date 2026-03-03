import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Footer } from '@/components/Footer';

export default function PrivacyPage() {
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
          {isSr ? 'Politika privatnosti' : 'Privacy Policy'}
        </h1>

        <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground">
          <p className="text-sm">{isSr ? 'Poslednje ažuriranje: mart 2026.' : 'Last updated: March 2026'}</p>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{isSr ? '1. Uvod' : '1. Introduction'}</h2>
            <p>{isSr
              ? 'Ova politika privatnosti opisuje kako Quizestro prikuplja, koristi i štiti vaše lične podatke. Vaša privatnost nam je veoma važna i posvećeni smo zaštiti vaših podataka.'
              : 'This privacy policy describes how Quizestro collects, uses, and protects your personal data. Your privacy is very important to us and we are committed to protecting your data.'
            }</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{isSr ? '2. Podaci koje prikupljamo' : '2. Data We Collect'}</h2>
            <p>{isSr ? 'Prikupljamo sledeće podatke:' : 'We collect the following data:'}</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>{isSr ? 'Email adresa i ime pri registraciji' : 'Email address and name during registration'}</li>
              <li>{isSr ? 'Podaci o organizaciji (naziv, logo)' : 'Organization data (name, logo)'}</li>
              <li>{isSr ? 'Podaci o kvizovima, timovima i rezultatima' : 'Quiz, team, and score data'}</li>
              <li>{isSr ? 'Tehničke informacije (IP adresa, tip pretraživača)' : 'Technical information (IP address, browser type)'}</li>
              <li>{isSr ? 'Poruke poslate putem kontakt forme' : 'Messages sent via the contact form'}</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{isSr ? '3. Kako koristimo podatke' : '3. How We Use Data'}</h2>
            <p>{isSr ? 'Vaše podatke koristimo za:' : 'We use your data to:'}</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>{isSr ? 'Pružanje i poboljšanje usluge' : 'Provide and improve our service'}</li>
              <li>{isSr ? 'Upravljanje vašim nalogom i organizacijom' : 'Manage your account and organization'}</li>
              <li>{isSr ? 'Komunikaciju u vezi sa uslugom' : 'Communication regarding the service'}</li>
              <li>{isSr ? 'Analizu korišćenja radi poboljšanja platforme' : 'Usage analysis to improve the platform'}</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{isSr ? '4. Zaštita podataka' : '4. Data Protection'}</h2>
            <p>{isSr
              ? 'Primenjujemo odgovarajuće tehničke i organizacione mere za zaštitu vaših podataka od neovlašćenog pristupa, gubitka ili uništenja. Svi podaci se čuvaju na sigurnim serverima sa enkripcijom.'
              : 'We implement appropriate technical and organizational measures to protect your data from unauthorized access, loss, or destruction. All data is stored on secure servers with encryption.'
            }</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{isSr ? '5. Deljenje podataka' : '5. Data Sharing'}</h2>
            <p>{isSr
              ? 'Ne prodajemo i ne delimo vaše lične podatke sa trećim stranama, osim kada je to neophodno za pružanje usluge (npr. procesori plaćanja) ili kada to zakon zahteva.'
              : 'We do not sell or share your personal data with third parties, except when necessary to provide the service (e.g., payment processors) or when required by law.'
            }</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{isSr ? '6. Kolačići' : '6. Cookies'}</h2>
            <p>{isSr
              ? 'Koristimo tehničke kolačiće neophodne za funkcionisanje platforme (sesija, autentifikacija). Ne koristimo kolačiće za praćenje ili reklamiranje.'
              : 'We use technical cookies necessary for the platform to function (session, authentication). We do not use tracking or advertising cookies.'
            }</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{isSr ? '7. Vaša prava' : '7. Your Rights'}</h2>
            <p>{isSr ? 'Imate pravo da:' : 'You have the right to:'}</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>{isSr ? 'Pristupite svojim ličnim podacima' : 'Access your personal data'}</li>
              <li>{isSr ? 'Ispravite netačne podatke' : 'Correct inaccurate data'}</li>
              <li>{isSr ? 'Zatražite brisanje vaših podataka' : 'Request deletion of your data'}</li>
              <li>{isSr ? 'Povučete saglasnost za obradu podataka' : 'Withdraw consent for data processing'}</li>
              <li>{isSr ? 'Prenesete svoje podatke na drugu platformu' : 'Transfer your data to another platform'}</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{isSr ? '8. Čuvanje podataka' : '8. Data Retention'}</h2>
            <p>{isSr
              ? 'Vaše podatke čuvamo sve dok je vaš nalog aktivan. Nakon brisanja naloga, vaši lični podaci se brišu u roku od 30 dana, osim ako zakon zahteva duže čuvanje.'
              : 'We retain your data as long as your account is active. After account deletion, your personal data is deleted within 30 days, unless longer retention is required by law.'
            }</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{isSr ? '9. Kontakt' : '9. Contact'}</h2>
            <p>{isSr
              ? 'Za sva pitanja u vezi sa privatnošću i zaštitom podataka, kontaktirajte nas putem kontakt forme na sajtu.'
              : 'For any questions regarding privacy and data protection, contact us via the contact form on our website.'
            }</p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
