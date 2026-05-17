import type { CpApi } from '../../electron/preload';

export function getCp(): CpApi {
  if (typeof window === 'undefined' || !window.cp) {
    throw new Error('window.cp is not available — preload script failed?');
  }
  return window.cp;
}

export function getCpSafe(): CpApi | null {
  if (typeof window === 'undefined' || !window.cp) return null;
  return window.cp;
}
