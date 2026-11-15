// Le coach est-il utilisable ? Activé dans Réglages ET modèle installé (lot 4, étape C7).
// Sert à afficher ou masquer les liens « Pourquoi ? ».

import { getUserSettings } from '@/db/appSettings';

import { getInstalledModel } from './modelStore';

export async function isCoachAvailable(): Promise<boolean> {
  if (getInstalledModel() === null) return false;
  const user = await getUserSettings();
  return user.coachEnabled;
}
