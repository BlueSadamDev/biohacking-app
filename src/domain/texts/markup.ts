// Relief dans une phrase (DESIGN.md, « Textes » > « Relief ») : le passage entre astérisques est mis en
// avant. « Tu t’entraînes *45 % de plus* que d’habitude » : un passage avec un chiffre prend la police
// des chiffres, un passage sans chiffre (une action) passe en gras. Les astérisques ne sont jamais
// affichés ; un astérisque isolé reste tel quel.

export type Emphasis = 'number' | 'action';
export type TextPart = { text: string; emphasis: Emphasis | null };

const MARK = /\*([^*\n]+)\*/g;

/** Découpe une phrase balisée en morceaux normaux et morceaux en relief. */
export function parseEmphasis(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(MARK)) {
    const start = m.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start), emphasis: null });
    const inner = m[1];
    parts.push({ text: inner, emphasis: /\d/.test(inner) ? 'number' : 'action' });
    last = start + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), emphasis: null });
  return parts;
}

/** La phrase sans balisage : notifications, lecteurs d'écran, résumé du coach, export. */
export function plainText(text: string): string {
  return parseEmphasis(text)
    .map((p) => p.text)
    .join('');
}

/** Valeur saisie par l'utilisateur (nom d'un comportement…) insérée dans une phrase : sans astérisque. */
export function userText(value: string): string {
  return value.replace(/\*/g, '');
}
