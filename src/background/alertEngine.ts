// Moteur d'alertes branché sur la base : lancé après chaque synchro (app ouverte ou tâche de fond).
// Les règles et la sélection sont dans src/domain/alerts.ts (calcul pur, testé).
// Les alertes « Important » hors plage silencieuse partent en notification immédiate ;
// les autres sont enregistrées et regroupées dans le récap du matin.
// Relancer le moteur le même jour ne crée pas de doublon (anti-répétition de la sélection).

import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';

import { saveAlerts, loadAlertHistory } from '@/db/alerts';
import { getUserSettings } from '@/db/appSettings';
import { loadMeals, loadNights, loadWeights } from '@/db/healthData';
import { loadLoadInputs } from '@/db/loadData';
import { loadStrengthHistory } from '@/db/strength';
import { evaluateAlerts, LEVEL_LABEL, selectAlerts, type SelectedAlert } from '@/domain/alerts';
import { calibrationStatus } from '@/domain/calibration';
import { weightByDay } from '@/domain/daily';
import { addDays, dayKey, daysBetween } from '@/domain/dates';
import { dailyLoads, sessionLoads } from '@/domain/load';
import { nutritionByDay } from '@/domain/nutrition';
import { SETTINGS } from '@/domain/settings';

import { getNotificationPermission } from './morningNotification';

const DAY_MS = 24 * 60 * 60 * 1000;
const CHANNEL_ID = 'alertes';

async function notify(alerts: SelectedAlert[]): Promise<void> {
  if (alerts.length === 0 || (await getNotificationPermission()) !== 'granted') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Alertes',
    importance: AndroidImportance.HIGH,
    // Écran verrouillé : le contenu reste masqué.
    lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
  });
  for (const a of alerts) {
    await Notifications.scheduleNotificationAsync({
      content: { title: `${LEVEL_LABEL[a.level]} · ${a.title}`, body: `${a.finding} ${a.action}` },
      trigger: { channelId: CHANNEL_ID },
    });
  }
}

let running: Promise<SelectedAlert[]> | null = null;

/** Calcule, enregistre et envoie les alertes du jour. Renvoie les alertes ajoutées. */
export function runAlertEngine(now: Date = new Date()): Promise<SelectedAlert[]> {
  // Une seule exécution à la fois (synchro de l'app et tâche de fond peuvent se croiser).
  if (!running) running = run(now).finally(() => (running = null));
  return running;
}

async function run(now: Date): Promise<SelectedAlert[]> {
  const a = SETTINGS.alerts;
  const today = dayKey(now);
  const [nights, user] = await Promise.all([loadNights(), getUserSettings()]);

  const loadInputs = await loadLoadInputs(nights, today, now, a.underloadDays);
  const dailyLoad =
    loadInputs.hrMax !== null && loadInputs.coefficient !== null
      ? dailyLoads(sessionLoads(loadInputs.sessions, loadInputs.samples, nights, loadInputs.hrMax, loadInputs.coefficient))
      : null;
  const loadHistoryDays = loadInputs.historyStart ? daysBetween(loadInputs.historyStart, today) + 1 : 0;

  const weeks = 7 * (a.weightWeeks + 1) + 1;
  const [weights, meals, strength] = await Promise.all([
    loadWeights(now.getTime() - weeks * DAY_MS),
    loadMeals(now.getTime() - (a.proteinWindowDays + 2) * DAY_MS),
    loadStrengthHistory(now),
  ]);

  const candidates = evaluateAlerts({
    nights,
    dailyLoad,
    loadHistoryDays,
    weights: weightByDay(weights),
    nutrition: nutritionByDay(meals),
    proteinGPerKg: user.proteinGPerKg,
    strength,
    today,
  });

  const selected = selectAlerts(candidates, {
    calibrationDone: calibrationStatus(nights, today).done,
    alertsEnabled: user.alertsEnabled,
    history: await loadAlertHistory(addDays(today, -a.persistentWindowDays)),
    today,
    now: { hour: now.getHours(), minute: now.getMinutes() },
    quietStart: user.quietStart,
    quietEnd: user.quietEnd,
  });

  await saveAlerts(selected, now.getTime());
  await notify(selected.filter((s) => s.delivery === 'now')).catch(() => undefined);
  return selected;
}
