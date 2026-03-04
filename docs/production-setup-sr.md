# Quizestro — produkcioni setup (Mint + Supabase + Stripe + transactional email)

Ovaj dokument je praktičan vodič da aplikaciju objaviš na:

- `quizestro.darkmsolutions.com` (frontend)
- Supabase Edge Functions (backend logika)
- Stripe (naplata pretplate)
- Postmark (transactional email sa template-ima)

> Napomena: Mint MySQL baza ti nije potrebna za ovu aplikaciju jer već koristiš Supabase (Postgres + Auth + Edge Functions).

## 1) Deploy frontend-a na Mint

Aplikacija je Vite/React. Prvo napravi build:

```bash
npm ci
npm run build
```

Uploadaj sadržaj `dist/` foldera na Mint hosting u folder koji služi za subdomen `quizestro.darkmsolutions.com`.

Ako Mint koristi Apache, dodaj `.htaccess` u root subdomena (zbog SPA routinga):

```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

## 2) DNS za subdomen

U DNS zoni `darkmsolutions.com` podesi:

- `A` record za `quizestro` ka IP adresi Mint hostinga
- ili `CNAME` `quizestro -> tvoj-mint-host` (ako Mint tako preporučuje)

Proveri:

```bash
dig +short quizestro.darkmsolutions.com
```

## 3) Produkcioni env za frontend

Frontend treba da zna gde je Supabase projekat. Na buildu/hostingu postavi:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (preporučeno) ili `VITE_SUPABASE_ANON_KEY`

Lokalno to ide u `.env`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
```

## 4) Supabase Edge Functions — deploy

Iz root-a projekta:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy billing-checkout
supabase functions deploy billing-webhook
supabase functions deploy billing-cancel
supabase functions deploy send-email
```

Ako koristiš i ostale funkcije, deploy i njih.

## 5) Secrets za funkcije (Stripe + email)

Postavi secrets u Supabase projektu:

```bash
supabase secrets set \
SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
SUPABASE_ANON_KEY=YOUR_ANON_KEY \
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY \
STRIPE_SECRET_KEY=sk_live_xxx \
STRIPE_PRICE_ID_MONTHLY=price_xxx \
STRIPE_PRICE_ID_ANNUAL=price_xxx \
STRIPE_WEBHOOK_SECRET=whsec_xxx \
SITE_URL=https://quizestro.darkmsolutions.com \
POSTMARK_SERVER_TOKEN=YOUR_POSTMARK_SERVER_TOKEN \
POSTMARK_FROM_EMAIL=billing@darkmsolutions.com
```

## 6) Stripe povezivanje (pretplata)

U Stripe Dashboard-u:

1. Kreiraj Product + Price za Monthly i Annual.
2. Price ID vrednosti upiši u `STRIPE_PRICE_ID_MONTHLY` i `STRIPE_PRICE_ID_ANNUAL`.
3. Podesi webhook endpoint:
   `https://YOUR_PROJECT.supabase.co/functions/v1/billing-webhook`
4. Uključi događaje:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

U kodu su checkout i webhook funkcije prebačene na Stripe.

## 7) Transactional email + template-i

Funkcija `send-email` već ima template tipove (npr. pozivnica, reset lozinke, potvrda pretplate). Za produkciju:

1. Verifikuj domen i sender u Postmark-u (ili drugom SMTP/API provajderu).
2. Postavi `POSTMARK_SERVER_TOKEN` i `POSTMARK_FROM_EMAIL` secrets.
3. Pozivaj edge funkciju sa `type`, `to` i `variables`.

Primer poziva:

```ts
const { data, error } = await supabase.functions.invoke("send-email", {
  body: {
    type: "subscription_receipt",
    to: "korisnik@domen.com",
    variables: { planName: "Pro Monthly" },
  },
});
```

## 8) Supabase Auth URL podešavanja

U Supabase Dashboard -> Authentication -> URL Configuration:

- Site URL: `https://quizestro.darkmsolutions.com`
- Redirect URLs: dodaj sve potrebne callback rute, npr.
  - `https://quizestro.darkmsolutions.com/reset-password`
  - `https://quizestro.darkmsolutions.com/*`

Bez ovoga reset lozinke i auth callback često pucaju u produkciji.

## 9) CORS i domeni

Pošto se frontend vrti na custom domenu, potvrdi da pozivi ka `functions/v1/*` rade bez CORS problema.
Ako bude potrebno, u funkcijama su već uključeni CORS header-i, ali proveri da reverse proxy na Mint-u ne prepravlja zaglavlja.

## 10) Brza produkciona checklista

- [ ] `quizestro.darkmsolutions.com` pokazuje na Mint i ima SSL
- [ ] Frontend build (`dist`) je uploadovan
- [ ] SPA routing radi (`.htaccess`)
- [ ] `VITE_SUPABASE_URL` i `VITE_SUPABASE_PUBLISHABLE_KEY` (ili anon key) su produkcioni
- [ ] Sve Supabase funkcije deployovane
- [ ] Stripe webhook aktivan i potpis validan
- [ ] Postmark sender verifikovan
- [ ] Email template-i poslati uspešno iz `send-email`
- [ ] Test kupovina menja `organizations.subscription_status`


## 11) Automatska pred-produkciona provera

Dodat je skript `scripts/release-check.sh` koji proverava:

- obavezne frontend env varijable
- prisustvo ključnih edge funkcija
- opcionalno DNS/HTTPS dostupnost domena i webhook endpoint-a

Pokretanje:

```bash
npm run release:check
```

Ako testiraš lokalno bez interneta / bez DNS-a:

```bash
npm run release:check -- --skip-network
```

Skript će vratiti `exit 1` samo za blokirajuće probleme.


---

Ovaj check je zamišljen kao brza zaštita od najčešćih propusta pre objave.


## 12) Troubleshooting: `otp_expired` posle klika na verifikacioni email

Ako te link odvede na URL tipa:
`...#error=access_denied&error_code=otp_expired...`

najčešći uzroci su:

1. **Pogrešan Site URL / Redirect URL u Supabase Auth** (npr. ostao `*.lovableproject.com`).
2. Link je **otvoren više puta** (OTP link je jednokratan).
3. Link je istekao zbog TTL-a.

Obavezno proveri u Supabase Dashboard -> Authentication -> URL Configuration:

- Site URL: `https://quizestro.darkmsolutions.com`
- Redirect URLs:
  - `https://quizestro.darkmsolutions.com/auth/callback`
  - `https://quizestro.darkmsolutions.com/reset-password`
  - `https://quizestro.darkmsolutions.com/*`

U aplikaciji je dodat dedicated callback route `/auth/callback` da korisnik dobije jasnu poruku i fallback akcije kada je link istekao.


## 13) Ako Lemon odbije nalog — pređi na Stripe

Ako od Lemon Squeezy dobiješ poruku poput:

> "we don't currently allow services of any kind ..."

to znači da je nalog/proizvod klasifikovan kao **usluga** koju ne mogu da verifikuju na checkout-u.

Praktične opcije:

1. **Reklasifikuj proizvod kao SaaS/digital subscription**
   - Jasno opiši šta korisnik dobija odmah nakon kupovine (npr. premium feature access u aplikaciji).
   - U Terms/Privacy i product copy izbegni formulacije koje zvuče kao consulting/agencija usluga.
2. **Ako i dalje odbijaju, pređi na drugi billing provider** (npr. Stripe Billing/Paddle).
3. Dok provider nije odobren, sakrij/disable upgrade CTA u produkciji da korisnici ne udaraju u blokiran checkout.

U ovom kodu je unapređeno rukovanje greškom checkout-a tako da se provider poruka vrati do UI-a umesto generičkog "Failed to create checkout session".


## 14) Auth email preko Postmark (bez Supabase template-a)

Za registraciju i reset lozinke frontend sada koristi Edge funkciju `auth-send-email` koja:

- generiše Supabase auth link (`admin.generateLink`)
- šalje email preko Postmark API-ja sa custom HTML template-om

Deploy komanda:

```bash
supabase functions deploy auth-send-email
```

Time više ne zavisiš od default Supabase Auth template email-ova za signup/recovery.
