// Mise en forme des valeurs et des dates pour l'affichage (français).

/** 452 → « 7 h 32 ». */
export function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

/** « AAAA-MM-JJ » → Date locale à midi. */
export function dateFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** « Jeudi 13 novembre ». */
export function formatLongDate(date: Date): string {
  return capitalize(date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));
}

/** « 13/11 ». */
export function formatShortDate(key: string): string {
  const [, m, d] = key.split('-');
  return `${d}/${m}`;
}

/** « 13/11 à 07:42 ». */
export function formatDateTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} à ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Nombre à virgule (« 78,4 »). */
export function formatDecimal(value: number, digits = 1): string {
  return value.toFixed(digits).replace('.', ',');
}
