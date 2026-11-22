import { useTranslation } from 'react-i18next';
import i18n from '../i18n/config';

export function ep(key, options) {
  return i18n.t(`eProcess.${key}`, options);
}

export function useEp() {
  const { t } = useTranslation();
  return (key, options) => t(`eProcess.${key}`, options);
}
