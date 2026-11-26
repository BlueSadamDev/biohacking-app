// Tâche de fond : synchro Health Connect, alertes, puis mise à jour de la notification du matin.
// Android décide du moment exact (WorkManager) : au plus une fois par heure ici,
// souvent moins quand le téléphone est en veille profonde.
//
// Ce fichier doit être importé au démarrage de l'app (src/app/_layout.tsx) :
// la tâche doit être déclarée avant qu'Android ne la lance.

import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { beginSyncRun, endSyncRun, settleWithin } from '@/db/syncRuns';
import { SETTINGS } from '@/domain/settings';
import { getStatus, syncHealthConnect } from '@/sources/healthConnect';

import { runAlertEngine } from './alertEngine';
import { runPeriodReminder } from './periodReminder';
import { runStrengthReminder } from './strengthReminder';
import {
  getNotificationPermission,
  requestNotificationPermission,
  scheduleMorningNotifications,
} from './morningNotification';

export const SYNC_TASK = 'biohacking-sync';

TaskManager.defineTask(SYNC_TASK, async () => {
  // Mesure de la synchro (lot 5b) : relevé enregistré à la fin de la tâche, réussie ou non.
  const { recorder, owner } = beginSyncRun('background');
  try {
    // Tâche de fond : pas de rattrapage de la FC des séances (seulement avec l'app ouverte).
    if ((await getStatus()) === 'available') await syncHealthConnect(Date.now(), { interactive: false });
    await runAlertEngine().catch(() => undefined);
    await runStrengthReminder().catch(() => undefined);
    await runPeriodReminder().catch(() => undefined);
    // Le relevé n'attend la notification du matin que quelques secondes (voir useHealthData).
    await settleWithin(scheduleMorningNotifications(), SETTINGS.sync.runFinishWaitSeconds);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    // Pas de détail dans les logs : il pourrait contenir des données de santé.
    return BackgroundTask.BackgroundTaskResult.Failed;
  } finally {
    if (owner) await endSyncRun(recorder);
  }
});

/** Inscrit la tâche auprès d'Android (sans effet si elle l'est déjà). */
export async function registerSyncTask(): Promise<void> {
  const status = await BackgroundTask.getStatusAsync();
  if (status === BackgroundTask.BackgroundTaskStatus.Restricted) return;
  if (await TaskManager.isTaskRegisteredAsync(SYNC_TASK)) return;
  await BackgroundTask.registerTaskAsync(SYNC_TASK, {
    minimumInterval: SETTINGS.sync.backgroundIntervalMinutes,
  });
}

/** Au démarrage : tâche de fond, autorisation des notifications (demandée une fois), programmation. */
export async function setupBackground(): Promise<void> {
  try {
    await registerSyncTask();
  } catch {
    // Tâche indisponible : l'app fonctionne quand même (synchro à l'ouverture).
  }
  if ((await getNotificationPermission()) === 'undetermined') await requestNotificationPermission();
  await scheduleMorningNotifications();
}
