import ar from './ar.json';
import en from './en.json';

export type Locale = 'ar' | 'en';

const DICTS: Record<Locale, unknown> = { ar, en };

/** t('play.checkmate') — dot-path lookup with graceful fallback to the key. */
export function makeT(locale: Locale) {
  const dict = DICTS[locale] as Record<string, unknown>;
  return (key: string): string => {
    let node: unknown = dict;
    for (const part of key.split('.')) {
      if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
        node = (node as Record<string, unknown>)[part];
      } else {
        return key;
      }
    }
    return typeof node === 'string' ? node : key;
  };
}

export type T = ReturnType<typeof makeT>;

/** structural parity check between locales (unit-tested) */
export function localeParity(): string[] {
  const flat = (o: unknown, prefix = ''): string[] => {
    const keys: string[] = [];
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      const p = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object') keys.push(...flat(v, p));
      else keys.push(p);
    }
    return keys;
  };
  const arKeys = new Set(flat(ar));
  const enKeys = new Set(flat(en));
  const missing = [];
  for (const k of arKeys) if (!enKeys.has(k)) missing.push(`en missing: ${k}`);
  for (const k of enKeys) if (!arKeys.has(k)) missing.push(`ar missing: ${k}`);
  return missing;
}
