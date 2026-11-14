// Réglages (DESIGN.md, « Écrans du lot 2 ») : Mes cibles, Profil cardiaque,
// Notifications, Données. Les valeurs sont enregistrées dans la base locale.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { scheduleMorningNotifications } from '@/background/morningNotification';
import { AppText } from '@/components/AppText';
import { formatDecimal } from '@/components/format';
import { Screen } from '@/components/Screen';
import {
  ChoiceChips,
  NumberField,
  SettingLink,
  SettingRow,
  SettingsGroup,
  Switch,
  TimeStepper,
} from '@/components/SettingsControls';
import { colors } from '@/components/theme';
import { reloadFromDb } from '@/components/useHealthData';
import { getUserSettings, setUserSetting } from '@/db/appSettings';
import { eraseAllData, exportAllToCsv } from '@/db/dataAdmin';
import { loadWeights } from '@/db/healthData';
import { weightByDay } from '@/domain/daily';
import { dayKey } from '@/domain/dates';
import { formatTime, shiftTime, type TimeOfDay } from '@/domain/notification';
import {
  averageWeight,
  effectiveHrMax,
  estimateHrMax,
  parseBirthYear,
  parseNumber,
  proteinTargetGrams,
  type Sex,
  type UserSettings,
} from '@/domain/profile';
import { SETTINGS } from '@/domain/settings';

const DAY_MS = 24 * 60 * 60 * 1000;
const SEX_OPTIONS = [
  { value: 'male', label: 'Homme' },
  { value: 'female', label: 'Femme' },
] as const;

const asInt = (v: number) => String(v);
const asDecimal = (v: number) => formatDecimal(v, 1);

export default function SettingsScreen() {
  const router = useRouter();
  const [user, setUser] = useState<UserSettings | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [busy, setBusy] = useState<'export' | 'erase' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    getUserSettings().then(setUser).catch(() => setUser(null));
    loadWeights(Date.now() - (SETTINGS.targets.weightAverageDays + 1) * DAY_MS)
      .then((w) => setWeight(averageWeight(weightByDay(w), dayKey(new Date()))))
      .catch(() => setWeight(null));
  }, []);
  useFocusEffect(refresh);

  async function save<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    setUser((u) => (u ? { ...u, [key]: value } : u));
    await setUserSetting(key, value);
    if (key === 'notificationTime') await scheduleMorningNotifications().catch(() => undefined);
  }

  function shift(key: 'notificationTime' | 'quietStart' | 'quietEnd', delta: number) {
    if (!user) return;
    const step = key === 'notificationTime' ? SETTINGS.notification.stepMinutes : SETTINGS.quietHours.stepMinutes;
    save(key, shiftTime(user[key] as TimeOfDay, delta * step));
  }

  async function exportCsv() {
    setBusy('export');
    setMessage(null);
    try {
      const n = await exportAllToCsv();
      setMessage(n === null ? 'Export annulé.' : `${n} fichiers CSV enregistrés dans le dossier choisi.`);
    } catch {
      setMessage("L'export a échoué : choisis un autre dossier et réessaie.");
    } finally {
      setBusy(null);
    }
  }

  function confirmErase() {
    Alert.alert(
      'Effacer toutes les données ?',
      'Tes saisies (poids, ressenti, musculation) seront perdues définitivement. Les données de Health Connect seront relues à la prochaine synchro. Tes réglages sont conservés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Effacer',
          style: 'destructive',
          onPress: async () => {
            setBusy('erase');
            try {
              await eraseAllData();
              await reloadFromDb();
              setMessage('Données effacées.');
              refresh();
            } catch {
              setMessage("L'effacement a échoué.");
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  if (!user) {
    return (
      <Screen>
        <AppText variant="title">Réglages</AppText>
      </Screen>
    );
  }

  const now = new Date();
  const t = SETTINGS.targets;
  const p = SETTINGS.profile;
  const proteinGrams = proteinTargetGrams(user.proteinGPerKg, weight);
  const estimated = estimateHrMax(user.birthYear, now);
  const hrMax = effectiveHrMax(user, now);

  return (
    <Screen>
      <AppText variant="title">Réglages</AppText>

      <SettingsGroup
        title="Mes cibles"
        footer={
          proteinGrams === null
            ? 'Ajoute une pesée pour calculer ta cible de protéines en grammes.'
            : `Soit ${proteinGrams} g de protéines par jour avec ton poids actuel (moyenne 7 j).`
        }>
        <SettingRow label="Poids visé">
          <NumberField
            label="Poids visé en kilos"
            value={user.targetWeightKg}
            placeholder="à définir"
            unit="kg"
            parse={(s) => parseNumber(s, SETTINGS.entry.weightMinKg, SETTINGS.entry.weightMaxKg, 1)}
            format={asDecimal}
            onCommit={(v) => save('targetWeightKg', v)}
          />
        </SettingRow>
        <SettingRow label="Protéines">
          <NumberField
            label="Protéines en grammes par kilo"
            value={user.proteinGPerKg}
            unit="g/kg"
            parse={(s) => parseNumber(s, t.proteinGPerKgMin, t.proteinGPerKgMax, 1)}
            format={asDecimal}
            onCommit={(v) => save('proteinGPerKg', v ?? t.proteinGPerKgDefault)}
          />
        </SettingRow>
        <SettingRow label="Calories par jour">
          <NumberField
            label="Calories par jour"
            value={user.caloriesKcal}
            placeholder="à définir"
            unit="kcal"
            parse={(s) => parseNumber(s, t.caloriesMin, t.caloriesMax)}
            format={asInt}
            onCommit={(v) => save('caloriesKcal', v)}
          />
        </SettingRow>
        <SettingRow label="Séances par semaine">
          <NumberField
            label="Séances par semaine"
            value={user.sessionsPerWeek}
            unit="/ sem."
            parse={(s) => parseNumber(s, 0, t.sessionsPerWeekMax)}
            format={asInt}
            onCommit={(v) => save('sessionsPerWeek', v ?? t.sessionsPerWeekDefault)}
          />
        </SettingRow>
        <SettingRow label="Zone 2 par semaine">
          <NumberField
            label="Minutes de zone 2 par semaine"
            value={user.zone2TargetMinutes}
            unit="min"
            parse={(s) => parseNumber(s, 0, t.zone2MinutesMax)}
            format={asInt}
            onCommit={(v) => save('zone2TargetMinutes', v ?? t.zone2MinutesDefault)}
          />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup
        title="Profil cardiaque"
        footer="Sert au calcul de la charge. Laisse la valeur estimée si tu ne connais pas la tienne.">
        <SettingRow label="Année de naissance">
          <NumberField
            label="Année de naissance"
            value={user.birthYear}
            placeholder="à définir"
            unit=""
            parse={(s) => parseBirthYear(s, now)}
            format={asInt}
            onCommit={(v) => save('birthYear', v)}
          />
        </SettingRow>
        <SettingRow label="Sexe" hint={user.sex === null ? 'à définir' : undefined}>
          <ChoiceChips<Sex> label="Sexe" options={SEX_OPTIONS} value={user.sex} onChange={(v) => save('sex', v)} />
        </SettingRow>
        <SettingRow
          label="FC max"
          hint={
            hrMax === null
              ? 'Renseigne ton année de naissance pour l’estimer.'
              : hrMax.source === 'estimated'
                ? 'estimée'
                : estimated !== null
                  ? `saisie (estimation : ${estimated} bpm)`
                  : 'saisie'
          }>
          <NumberField
            label="Fréquence cardiaque maximale"
            value={user.hrMaxBpm}
            placeholder={estimated === null ? 'à définir' : String(estimated)}
            unit="bpm"
            parse={(s) => parseNumber(s, p.hrMaxMin, p.hrMaxMax)}
            format={asInt}
            onCommit={(v) => save('hrMaxBpm', v)}
          />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Notifications">
        <SettingRow label="Heure du récap">
          <TimeStepper
            label="Heure du récap"
            text={formatTime(user.notificationTime)}
            onMinus={() => shift('notificationTime', -1)}
            onPlus={() => shift('notificationTime', 1)}
          />
        </SettingRow>
        <SettingRow label="Silence à partir de">
          <TimeStepper
            label="Début de la plage silencieuse"
            text={formatTime(user.quietStart)}
            onMinus={() => shift('quietStart', -1)}
            onPlus={() => shift('quietStart', 1)}
          />
        </SettingRow>
        <SettingRow label="Silence jusqu’à">
          <TimeStepper
            label="Fin de la plage silencieuse"
            text={formatTime(user.quietEnd)}
            onMinus={() => shift('quietEnd', -1)}
            onPlus={() => shift('quietEnd', 1)}
          />
        </SettingRow>
        <SettingRow label="Alertes">
          <Switch label="Alertes" value={user.alertsEnabled} onChange={(v) => save('alertsEnabled', v)} />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Données" footer={message ?? undefined}>
        <SettingLink label="Sources de données" onPress={() => router.push('/sources')} />
        <SettingLink
          label={busy === 'export' ? 'Export en cours…' : 'Exporter mes données (CSV)'}
          onPress={busy ? () => undefined : exportCsv}
        />
        <SettingLink
          label={busy === 'erase' ? 'Effacement en cours…' : 'Effacer toutes les données'}
          color={colors.low}
          onPress={busy ? () => undefined : confirmErase}
        />
      </SettingsGroup>
    </Screen>
  );
}
