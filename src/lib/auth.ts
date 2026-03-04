export function getSiteUrl(): string {
  const configured = import.meta.env.VITE_SITE_URL as string | undefined;
  if (configured && configured.trim().length > 0) {
    return configured.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return '';
}

export function buildSiteUrl(path: string): string {
  const base = getSiteUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
