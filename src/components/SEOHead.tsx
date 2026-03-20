import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

interface SEOHeadProps {
  titleKey?: string;
  descriptionKey?: string;
  titleFallback?: string;
  descriptionFallback?: string;
  type?: string;
  noIndex?: boolean;
}

const BASE_URL = 'https://quizestro.lovable.app';

export function SEOHead({
  titleKey,
  descriptionKey,
  titleFallback,
  descriptionFallback,
  type = 'website',
  noIndex = false,
}: SEOHeadProps) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const lang = i18n.language;

  const title = titleKey ? t(titleKey) : (titleFallback || 'Quizestro');
  const description = descriptionKey ? t(descriptionKey) : (descriptionFallback || '');
  const fullTitle = title.includes('Quizestro') ? title : `${title} | Quizestro`;
  const canonicalUrl = `${BASE_URL}${location.pathname}`;

  useEffect(() => {
    document.title = fullTitle;

    const setMeta = (name: string, content: string, attr = 'name') => {
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    if (description) {
      setMeta('description', description);
      setMeta('og:description', description, 'property');
      setMeta('twitter:description', description);
    }

    setMeta('og:title', fullTitle, 'property');
    setMeta('twitter:title', fullTitle);
    setMeta('og:type', type, 'property');
    setMeta('og:url', canonicalUrl, 'property');
    setMeta('og:locale', lang === 'sr' ? 'sr_RS' : 'en_US', 'property');
    setMeta('og:site_name', 'Quizestro', 'property');

    // Canonical
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);

    // HTML lang
    document.documentElement.lang = lang === 'sr' ? 'sr' : 'en';

    // Hreflang alternates
    const hreflangs = [
      { lang: 'en', href: canonicalUrl },
      { lang: 'sr', href: canonicalUrl },
      { lang: 'x-default', href: canonicalUrl },
    ];
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(el => el.remove());
    hreflangs.forEach(({ lang: hl, href }) => {
      const link = document.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', hl);
      link.setAttribute('href', href);
      document.head.appendChild(link);
    });

    if (noIndex) {
      setMeta('robots', 'noindex,nofollow');
    }

    return () => {
      document.title = 'Quizestro';
    };
  }, [fullTitle, description, canonicalUrl, lang, type, noIndex]);

  return null;
}
