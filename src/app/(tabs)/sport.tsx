// Onglet Sport (DESIGN.md, « Écrans du lot 3 »).
// Ordre : « Semaine du … au … » + « Ta progression » → carte « Cette semaine » → carte « Force · 1RM estimé »
// → bouton « Saisir ma séance de musculation ».
// Les cartes Composition corporelle et Suggestion arrivent aux étapes suivantes.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/Buttons';
import { formatWeekRange } from '@/components/format';
import { Screen } from '@/components/Screen';
import { SportWeekCard } from '@/components/SportWeekCard';
import { StrengthCard } from '@/components/StrengthCard';
import { useHealthData } from '@/components/useHealthData';
import { loadSportWeek, type SportWeek } from '@/db/sportData';
import { loadStrengthHistory } from '@/db/strength';
import { dayKey } from '@/domain/dates';
import { strengthProgress, type ExerciseProgress } from '@/domain/strength';

export default function SportScreen() {
  const router = useRouter();
  const { load, syncing, sync } = useHealthData();
  const [week, setWeek] = useState<SportWeek | null>(null);
  const [strength, setStrength] = useState<ExerciseProgress[] | null>(null);
  const [error, setError] = useState(false);

  const refresh = useCallback(() => {
    const now = new Date();
    Promise.all([loadSportWeek(now), loadStrengthHistory(now)])
      .then(([w, entries]) => {
        setWeek(w);
        setStrength(strengthProgress(entries, dayKey(now)));
        setError(false);
      })
      .catch(() => setError(true));
  }, []);
  useFocusEffect(refresh);
  // Après une synchro (la charge est recalculée), on relit aussi la semaine.
  useEffect(refresh, [load, refresh]);

  return (
    <Screen refreshing={syncing} onRefresh={sync}>
      <View>
        <AppText variant="small">{week ? formatWeekRange(week.weekStart, week.weekEnd) : ' '}</AppText>
        <AppText variant="title">Ta progression</AppText>
      </View>
      {error ? (
        <AppText variant="bodySmall">Impossible de lire tes séances. Tire vers le bas pour réessayer.</AppText>
      ) : (
        <>
          {week && <SportWeekCard week={week} load={load} />}
          {strength && <StrengthCard progress={strength} />}
        </>
      )}
      <PrimaryButton title="Saisir ma séance de musculation" onPress={() => router.push('/seance')} />
    </Screen>
  );
}
