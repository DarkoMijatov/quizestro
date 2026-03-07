

## Plan: Paddle Domain Compliance + Pricing/Copy Updates

### Problem Summary
Paddle requires: (1) a Refund Policy URL, (2) legal business name "DARKM SOLUTIONS" in Terms, (3) accessible homepage. Additionally: remove dinar prices, rename "Jednostavne cene", and change welcome text.

### Changes

**1. Create Refund Policy page (`src/pages/RefundPage.tsx`)**
- Bilingual refund policy page (same structure as Terms/Privacy pages)
- Cover: 14-day trial refund, cancellation policy, how to request refunds, contact info
- Reference "DARKM SOLUTIONS" as the legal entity

**2. Add `/refund` route in `src/App.tsx`**
- Register the new route alongside `/terms` and `/privacy`

**3. Update `src/pages/TermsPage.tsx`**
- Add "DARKM SOLUTIONS" as the legal business entity operating Quizestro in relevant sections (section 1 intro and section 9 contact)

**4. Update `src/components/Footer.tsx`**
- Add links to Terms, Privacy, and Refund Policy pages in the footer so Paddle can find them

**5. Update `src/i18n/locales/sr.json`**
- `pricing.title`: "Jednostavne cene" → "Jednostavni paketi"
- `pricing.free.priceDisplay`: "0 din" → "€0"
- `pricing.free.currency`: "din" → "€"
- `pricing.premium.priceDisplay`: "999 din" → "€9,99"
- `pricing.premium.currency`: "din" → "€"
- `pricing.annual.priceDisplay`: "9.999 din" → "€99"
- `pricing.annual.currency`: "din" → "€"
- `dashboard.welcome`: "Dobrodošli nazad" → "Kontrolna tabla"

**6. Update `src/i18n/locales/en.json`**
- `pricing.title`: "Simple pricing" → "Simple plans"
- `dashboard.welcome`: "Welcome back" → "Dashboard"

**7. Update `src/pages/LandingPage.tsx`**
- The homepage should already be accessible. No changes needed unless there's a rendering issue — will verify the hero section renders properly for crawlers (it uses framer-motion but content is in the DOM).

### Files affected
- `src/pages/RefundPage.tsx` (new)
- `src/App.tsx`
- `src/pages/TermsPage.tsx`
- `src/components/Footer.tsx`
- `src/i18n/locales/sr.json`
- `src/i18n/locales/en.json`

