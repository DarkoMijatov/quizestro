export function getLocaleFromLanguage(language?: string) {
  return language === 'sr' ? 'sr-RS' : 'en-US';
}

export function formatLocalizedNumber(
  value: number,
  language?: string,
  options?: Intl.NumberFormatOptions
) {
  return new Intl.NumberFormat(getLocaleFromLanguage(language), options).format(value);
}

export function formatAverage(value: number, language?: string) {
  return formatLocalizedNumber(value, language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPoints(value: number, language?: string) {
  return formatLocalizedNumber(value, language, {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}
