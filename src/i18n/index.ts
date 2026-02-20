import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import sr from './locales/sr.json';
import en from './locales/en.json';

const savedLang = localStorage.getItem('quizory-lang') || 'sr';

i18n.use(initReactI18next).init({
  resources: {
    sr: { translation: sr },
    en: { translation: en },
  },
  lng: savedLang,
  fallbackLng: 'sr',
  interpolation: { escapeValue: false },
});

export default i18n;
