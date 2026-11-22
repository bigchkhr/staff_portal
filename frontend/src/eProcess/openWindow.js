export const EPROCESS_WINDOW = 'staff-portal-e-process';
export const EPROCESS_PATH = '/e-process';

export function openEProcessWindow() {
  const width = Math.min(1440, window.screen.availWidth - 40);
  const height = Math.min(960, window.screen.availHeight - 80);
  const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
  const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
  const features = [
    'popup=yes',
    `width=${Math.round(width)}`,
    `height=${Math.round(height)}`,
    `left=${Math.round(left)}`,
    `top=${Math.round(top)}`,
    'resizable=yes',
    'scrollbars=yes',
    'toolbar=no',
    'location=no',
    'menubar=no',
    'status=no',
  ].join(',');
  const win = window.open(EPROCESS_PATH, EPROCESS_WINDOW, features);
  if (win) win.focus();
  return Boolean(win);
}
