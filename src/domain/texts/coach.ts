// Textes affichés du coach (lot 5a.1, DESIGN.md « Textes ») : écran Coach, bilan de la semaine,
// Modèle du coach. Les consignes données au modèle restent dans coachPrompt.ts.

export const COACH = {
  weeklyFailed: 'Le bilan de la semaine n’a pas pu être rédigé. Il sera réessayé à ta prochaine visite.',
} as const;

export const COACH_MODEL = {
  ready: 'Le coach est *prêt*.',
  weeklyWhen: 'le dimanche, quand tu ouvres le coach',
  deleteBody: (size: string) => `Le coach ne fonctionnera plus tant que tu ne l’auras pas réinstallé. Cela libère ${size}.`,
  step1: (fileName: string) => `Sur l’ordinateur, télécharge le fichier ${fileName} (lien dans le README du projet).`,
} as const;

/**
 * Bilan de la semaine écrit par l'app (quand le modèle n'a pas pu formuler de conseil sûr) :
 * des phrases, sans dire comment le bilan a été produit. `worked` et `stuck` sont des propositions
 * en minuscules (« ton sommeil a atteint la durée visée »).
 */
export function weeklySynthesis(worked: string[], stuck: string[], join: (items: string[]) => string): string {
  const cap = (t: string) => (/^[A-ZÀ-Ý]{2}/.test(t) ? t : t.charAt(0).toUpperCase() + t.slice(1));
  if (worked.length && stuck.length) return `${cap(join(worked))}. En revanche, ${join(stuck)}.`;
  if (stuck.length) {
    return `Cette semaine, ${join(stuck)}. Concentre-toi sur ${stuck.length > 1 ? 'ces points' : 'ce point'} la semaine prochaine.`;
  }
  if (worked.length) return `${cap(join(worked))}. Rien ne coince d’après tes chiffres.`;
  return 'Pas assez de données cette semaine pour un bilan détaillé.';
}
