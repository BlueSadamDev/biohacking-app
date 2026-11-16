// Mes périodes (Réglages > Données ; DESIGN.md, « Écrans du lot 5a ») : liste des périodes, de la plus
// récente à la plus ancienne (type, dates, nombre de jours). Toucher une période permet de modifier
// ses dates ou de la supprimer (avec confirmation).

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { scheduleMorningNotifications } from '@/background/morningNotification';
import { AppText } from '@/components/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Card } from '@/components/Card';
import { dateFromKey } from '@/components/format';
import { DateStepper } from '@/components/PeriodViews';
import { BackHeader, Screen } from '@/components/Screen';
import { Switch } from '@/components/SettingsControls';
import { colors, fonts } from '@/components/theme';
import { useHealthData } from '@/components/useHealthData';
import { deletePeriod, savePeriod } from '@/db/periods';
import { dayKey } from '@/domain/dates';
import { periodLength, validatePeriod, type Period } from '@/domain/periods';
import { SETTINGS } from '@/domain/settings';

const longDate = (key: string) => dateFromKey(key).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

function datesText(p: Period): string {
  if (p.end === null) return `Depuis le ${longDate(p.start)} · en cours`;
  if (p.end === p.start) return `Le ${longDate(p.start)}`;
  return `Du ${longDate(p.start)} au ${longDate(p.end)}`;
}

/** Modification d'une période : début, fin (ou « En cours »), enregistrer, supprimer. */
function PeriodEditor({
  period,
  periods,
  today,
  onDone,
}: {
  period: Period;
  periods: Period[];
  today: string;
  onDone: () => void;
}) {
  const [start, setStart] = useState(period.start);
  const [end, setEnd] = useState<string | null>(period.end);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const candidate = { ...period, start, end };
    const e = validatePeriod(candidate, periods, today, { isNew: false });
    if (e) {
      setError(e);
      return;
    }
    setBusy(true);
    try {
      await savePeriod(candidate);
      onDone();
    } catch (err) {
      setError(`L’enregistrement a échoué : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Supprimer cette période ?',
      'Ces jours compteront de nouveau dans tes normes, tes liens observés et tes suggestions.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await deletePeriod(period.id).catch(() => undefined);
            onDone();
          },
        },
      ],
    );
  }

  return (
    <View style={styles.editor}>
      <AppText variant="label">Début</AppText>
      <DateStepper value={start} min={null} max={end ?? today} today={today} label="Date de début" onChange={setStart} />
      <View style={styles.switchRow}>
        <AppText style={styles.rowText}>En cours</AppText>
        <Switch value={end === null} onChange={(v) => setEnd(v ? null : today)} label="Période en cours" />
      </View>
      {end !== null && (
        <>
          <AppText variant="label">Fin</AppText>
          <DateStepper value={end} min={start} max={today} today={today} label="Date de fin" onChange={setEnd} />
        </>
      )}
      {error && (
        <AppText variant="bodySmall" style={{ color: colors.low }}>
          {error}
        </AppText>
      )}
      <PrimaryButton title="Enregistrer" busy={busy} onPress={save} />
      <SecondaryButton title="Supprimer la période" color={colors.low} onPress={confirmDelete} />
    </View>
  );
}

export default function PeriodsScreen() {
  const router = useRouter();
  const { periods, reload } = useHealthData();
  const [open, setOpen] = useState<string | null>(null);
  const today = dayKey(new Date());

  async function done() {
    setOpen(null);
    await reload();
    scheduleMorningNotifications().catch(() => undefined);
  }

  return (
    <Screen bottomInset>
      <BackHeader title="Mes périodes" onBack={() => router.back()} />
      <AppText variant="bodySmall" style={{ color: colors.textMuted }}>
        Les jours d’une période sont exclus de tes normes, et les alertes sont en pause pendant la période. Pour en
        commencer une, touche le drapeau sur l’accueil.
      </AppText>

      {periods.length === 0 && <AppText variant="small">Aucune période pour l’instant.</AppText>}

      {periods.map((p) => {
        const days = periodLength(p, today);
        return (
          <Card key={p.id} style={styles.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open === p.id }}
              onPress={() => setOpen(open === p.id ? null : p.id)}
              style={styles.head}>
              <View style={styles.headText}>
                <AppText style={styles.type}>{SETTINGS.periods.labels[p.type]}</AppText>
                <AppText variant="bodySmall" style={{ color: colors.textSoft }}>
                  {datesText(p)}
                </AppText>
              </View>
              <AppText style={styles.days}>
                {days} jour{days > 1 ? 's' : ''}
              </AppText>
            </Pressable>
            {open === p.id && <PeriodEditor period={p} periods={periods} today={today} onDone={done} />}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  headText: { flex: 1, gap: 2 },
  type: { fontFamily: fonts.body600, fontSize: 15, color: colors.text },
  days: { fontFamily: fonts.display600, fontSize: 15, color: colors.text },
  editor: { gap: 10, borderTopWidth: 1, borderColor: colors.surfaceAlt, paddingTop: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 },
  rowText: { fontFamily: fonts.body400, fontSize: 14, color: colors.text },
});
