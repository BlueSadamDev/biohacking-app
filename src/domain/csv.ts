// Export CSV (sauvegarde manuelle) : transforme des lignes de la base en texte CSV.
// Séparateur « ; » et virgule décimale, pour une ouverture directe dans Excel en français.
// Chaque colonne d'heure (« …_ms ») est suivie d'une colonne lisible (« …_date »).

import { SETTINGS, type Settings } from './settings';

type Value = string | number | null;
export type Row = Record<string, Value>;

/** Date et heure locales lisibles : « 2026-01-10 07:30:00 ». */
export function localDateTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function cell(value: Value, settings: Settings): string {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'number' ? String(value) : value;
  if (typeof value === 'number' && settings.csv.decimalComma) text = text.replace('.', ',');
  const needsQuotes = text.includes(settings.csv.separator) || /["\r\n]/.test(text);
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Texte CSV (en-tête + lignes). Sans ligne : en-tête seul si `columns` est fourni, sinon vide. */
export function toCsv(rows: Row[], columns?: string[], settings: Settings = SETTINGS): string {
  const base = columns ?? (rows[0] ? Object.keys(rows[0]) : []);
  if (base.length === 0) return '';
  const header = base.flatMap((c) => (c.endsWith('_ms') ? [c, `${c.slice(0, -3)}_date`] : [c]));
  const lines = rows.map((row) =>
    base
      .flatMap((c) => {
        const v = row[c] ?? null;
        if (!c.endsWith('_ms')) return [cell(v, settings)];
        return [cell(v, settings), typeof v === 'number' ? localDateTime(v) : ''];
      })
      .join(settings.csv.separator),
  );
  return [header.join(settings.csv.separator), ...lines].join('\r\n') + '\r\n';
}
