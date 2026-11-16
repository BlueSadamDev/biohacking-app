// Étiquettes de période (DESIGN.md, « Écrans du lot 5a ») : bouton Période de l'en-tête,
// panneau « Signaler une période », bandeau de période de l'accueil, choix d'une date.

import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { addDays, daysBetween } from '@/domain/dates';
import { sinceLabel, type Period, type PeriodType } from '@/domain/periods';
import { SETTINGS } from '@/domain/settings';

import { AppText } from './AppText';
import { PrimaryButton, SecondaryButton } from './Buttons';
import { dateFromKey } from './format';
import { FlagIcon } from './Icons';
import { TimeStepper } from './SettingsControls';
import { colors, fonts, radius, tint, TOUCH } from './theme';

/** Bouton rond 44 × 44 (en-tête de l'accueil), à côté du bouton Alertes. */
export function PeriodButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Signaler une période"
      onPress={onPress}
      style={({ pressed }) => [styles.round, pressed && { opacity: 0.7 }]}>
      <FlagIcon size={22} />
    </Pressable>
  );
}

/** « Aujourd'hui », « Hier », « Il y a 3 jours · lundi 10 novembre ». */
export function relativeDayLabel(day: string, today: string): string {
  const n = daysBetween(day, today);
  const long = dateFromKey(day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  if (n === 0) return 'Aujourd’hui';
  if (n === 1) return `Hier · ${long}`;
  if (n > 1) return `Il y a ${n} jours · ${long}`;
  return long;
}

/** Choix d'une date par pas d'un jour (boutons − et +), entre `min` et `max`. */
export function DateStepper({
  value,
  min,
  max,
  today,
  label,
  onChange,
}: {
  value: string;
  min: string | null;
  max: string;
  today: string;
  label: string;
  onChange: (day: string) => void;
}) {
  return (
    <View style={styles.dateBlock}>
      <TimeStepper
        label={label}
        text={dateFromKey(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        onMinus={() => {
          const d = addDays(value, -1);
          if (!min || d >= min) onChange(d);
        }}
        onPlus={() => {
          const d = addDays(value, 1);
          if (d <= max) onChange(d);
        }}
      />
      <AppText variant="small">{relativeDayLabel(value, today)}</AppText>
    </View>
  );
}

/**
 * Panneau du bas « Signaler une période » : type (grille de 2 colonnes), date de début
 * (aujourd'hui par défaut, jusqu'à 14 jours en arrière), « Commencer la période », « Annuler ».
 */
export function PeriodSheet({
  visible,
  today,
  onStart,
  onClose,
}: {
  visible: boolean;
  today: string;
  /** Renvoie un message d'erreur (chevauchement…) ou null si la période est enregistrée. */
  onStart: (type: PeriodType, start: string) => Promise<string | null>;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {visible && <SheetContent today={today} onStart={onStart} onClose={onClose} />}
    </Modal>
  );
}

function SheetContent({ today, onStart, onClose }: { today: string; onStart: (type: PeriodType, start: string) => Promise<string | null>; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [type, setType] = useState<PeriodType | null>(null);
  const [start, setStart] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!type) {
      setError('Choisis le type de période.');
      return;
    }
    setBusy(true);
    const e = await onStart(type, start);
    setBusy(false);
    setError(e);
  }

  return (
    <>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />
        <AppText style={styles.sheetTitle}>Signaler une période</AppText>
        <AppText variant="bodySmall" style={{ color: colors.textMuted }}>
          Ces jours seront exclus de tes normes, et les alertes seront mises en pause.
        </AppText>
        <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="Type de période">
          {SETTINGS.periods.types.map((t) => {
            const active = t === type;
            return (
              <Pressable
                key={t}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setType(t);
                  setError(null);
                }}
                style={[styles.typeButton, active ? styles.typeActive : styles.typeIdle]}>
                <AppText style={[styles.typeText, { color: active ? colors.bg : colors.text }]}>{SETTINGS.periods.labels[t]}</AppText>
              </Pressable>
            );
          })}
        </View>
        <AppText variant="label">Date de début</AppText>
        <DateStepper
          value={start}
          min={addDays(today, -SETTINGS.periods.maxStartDaysBack)}
          max={today}
          today={today}
          label="Date de début"
          onChange={setStart}
        />
        {error && (
          <AppText variant="bodySmall" style={{ color: colors.low }}>
            {error}
          </AppText>
        )}
        <PrimaryButton title="Commencer la période" busy={busy} onPress={submit} />
        <SecondaryButton title="Annuler" onPress={onClose} />
      </View>
    </>
  );
}

/** Bandeau de période (accueil) : fond `info` à 10 %, bordure `info`, rayon 16. */
export function PeriodBanner({ period, today, onEnd }: { period: Period; today: string; onEnd: () => void }) {
  return (
    <View style={styles.banner}>
      <View style={styles.bannerTop}>
        <AppText style={styles.bannerKicker}>Période · {SETTINGS.periods.labels[period.type]}</AppText>
        <AppText variant="small">{sinceLabel(period, today)}</AppText>
      </View>
      <AppText style={styles.bannerTitle}>Tes normes et tes alertes sont en pause.</AppText>
      <AppText variant="bodySmall" style={{ color: colors.textSoft }}>
        {SETTINGS.periods.advice[period.type]}
      </AppText>
      <Pressable
        accessibilityRole="button"
        onPress={onEnd}
        hitSlop={4}
        style={({ pressed }) => [styles.endButton, pressed && { opacity: 0.7 }]}>
        <AppText style={styles.endText}>Terminer la période</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  round: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 12,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 4 },
  sheetTitle: { fontFamily: fonts.display600, fontSize: 18, color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeButton: {
    width: '48%',
    flexGrow: 1,
    height: 48,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIdle: { borderWidth: 1, borderColor: colors.border },
  typeActive: { backgroundColor: colors.text },
  typeText: { fontFamily: fonts.body600, fontSize: 15 },
  dateBlock: { gap: 6, alignItems: 'flex-start' },
  banner: {
    backgroundColor: tint(colors.info, 0.1),
    borderWidth: 1,
    borderColor: colors.info,
    borderRadius: radius.card,
    padding: 16,
    gap: 6,
  },
  bannerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  bannerKicker: { fontFamily: fonts.body600, fontSize: 12, color: colors.infoText, textTransform: 'uppercase', letterSpacing: 12 * 0.08 },
  bannerTitle: { fontFamily: fonts.body600, fontSize: 14, color: colors.text },
  endButton: {
    alignSelf: 'flex-start',
    marginTop: 6,
    minHeight: TOUCH,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.info,
    justifyContent: 'center',
  },
  endText: { fontFamily: fonts.body600, fontSize: 14, color: colors.infoText },
});
