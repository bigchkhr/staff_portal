import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import zhTW from './locales/zh-TW.json';
import zhCN from './locales/zh-CN.json';
import en from './locales/en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'zh-TW': {
        translation: zhTW
      },
      'zh-CN': {
        translation: zhCN
      },
      'en': {
        translation: en
      }
    },
    fallbackLng: 'zh-TW',
    lng: localStorage.getItem('i18nextLng') || 'zh-TW',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;

