// Garde-fou des textes affichés (DESIGN.md, « Textes ») : ce qu'une phrase de l'app ne doit jamais
// contenir. Utilisé par le test textGuard.test.ts (lecture du code) et par les tests des calculs qui
// produisent des phrases (alertes…).

const RULES: { problem: string; pattern: RegExp }[] = [
  { problem: 'apostrophe droite (’ attendue)', pattern: /'/ },
  { problem: 'guillemets droits (« » attendus)', pattern: /"/ },
  { problem: 'pluriel « (s) »', pattern: /\(s\)/ },
  { problem: '« à définir » (une invitation est attendue)', pattern: /à définir/i },
  {
    problem: 'vocabulaire médical',
    pattern:
      /infection|maladie|diagnosti|patholog|sympt[ôo]m|syndrome|d[ée]pression|burn-?out|insomnie|apn[ée]e|troubles? du sommeil/i,
  },
  { problem: 'mot du glossaire à abandonner : « plage » (« norme »)', pattern: /\bplages?\b/i },
  { problem: 'mot du glossaire à abandonner : « kilos » (« kg »)', pattern: /\bkilos?\b/i },
  { problem: 'mot du glossaire à abandonner : « ratio »', pattern: /\bratios?\b/i },
  { problem: 'mot du glossaire à abandonner : « 7 j / 28 j »', pattern: /7\s*j\s*\/\s*28\s*j/i },
  { problem: 'mot du glossaire à abandonner : « silence à partir de / jusqu’à »', pattern: /silence (à partir|jusqu)/i },
];

/** Problèmes trouvés dans une phrase affichée (vide si la phrase respecte la charte). */
export function textProblems(text: string): string[] {
  return RULES.filter((r) => r.pattern.test(text)).map((r) => r.problem);
}
