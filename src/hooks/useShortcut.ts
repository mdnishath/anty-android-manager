import { useEffect } from 'react';

type Combo = string; // e.g. "mod+b", "mod+k", "escape", "g d"

function normalizeKey(k: string): string {
  if (k === ' ') return 'space';
  return k.toLowerCase();
}

function matchSingle(combo: string, e: KeyboardEvent): boolean {
  const parts = combo.toLowerCase().split('+').map((p) => p.trim());
  const key = parts.pop();
  if (!key) return false;
  const wantMod = parts.includes('mod') || parts.includes('ctrl') || parts.includes('cmd');
  const wantShift = parts.includes('shift');
  const wantAlt = parts.includes('alt') || parts.includes('option');
  const isMod = e.ctrlKey || e.metaKey;
  if (wantMod !== isMod) return false;
  if (wantShift !== e.shiftKey) return false;
  if (wantAlt !== e.altKey) return false;
  return normalizeKey(e.key) === key;
}

export function useShortcut(combo: Combo, handler: (e: KeyboardEvent) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        // Allow Escape and modified shortcuts even in inputs
        if (e.key !== 'Escape' && !e.ctrlKey && !e.metaKey) return;
      }
      if (matchSingle(combo, e)) {
        e.preventDefault();
        handler(e);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [combo, handler, enabled]);
}
