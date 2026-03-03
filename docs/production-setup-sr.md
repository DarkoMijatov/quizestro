# Quizestro — produkcioni setup (Mint + Supabase + Lemon Squeezy + transactional email)

Ovaj dokument je praktičan vodič da aplikaciju objaviš na:

- `quizestro.darkmsolutions.com` (frontend)
- Supabase Edge Functions (backend logika)
- Lemon Squeezy (naplata pretplate)
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
- `VITE_SUPABASE_ANON_KEY`

Lokalno to ide u `.env`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
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

## 5) Secrets za funkcije (Lemon + email)

Postavi secrets u Supabase projektu:

```bash
supabase secrets set \
SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
SUPABASE_ANON_KEY=YOUR_ANON_KEY \
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY \
LEMONSQUEEZY_API_KEY=YOUR_LEMON_API_KEY \
LEMONSQUEEZY_STORE_ID=YOUR_STORE_ID \
LEMONSQUEEZY_VARIANT_ID_MONTHLY=YOUR_MONTHLY_VARIANT_ID \
LEMONSQUEEZY_VARIANT_ID_ANNUAL=YOUR_ANNUAL_VARIANT_ID \
LEMONSQUEEZY_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET \
POSTMARK_SERVER_TOKEN=YOUR_POSTMARK_SERVER_TOKEN \
POSTMARK_FROM_EMAIL=billing@darkmsolutions.com
```

## 6) Lemon Squeezy povezivanje (pretplata)

U Lemon Squeezy:

1. Kreiraj product + varijante (Monthly/Annual).
2. Upiši njihove variant ID-jeve u secrets.
3. Podesi webhook URL na:
   `https://YOUR_PROJECT.supabase.co/functions/v1/billing-webhook`
4. U webhook events uključi:
   - `subscription_created`
   - `subscription_updated`
   - `subscription_cancelled`
   - `subscription_expired`
   - `subscription_payment_failed`

U kodu su već pripremljene funkcije za checkout i webhook obradu.

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
- [ ] `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY` su produkcioni
- [ ] Sve Supabase funkcije deployovane
- [ ] Lemon Squeezy webhook aktivan i potpis validan
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
