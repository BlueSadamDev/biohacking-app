// Onglet Sport (DESIGN.md, « Écrans du lot 3 »).
// Étape C1 : « Semaine du … au … », titre, carte « Cette semaine » (séances, activité, charge, zones).
// Les cartes Force, Composition corporelle et Suggestion arrivent aux étapes suivantes.

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { formatWeekRange } from '@/components/format';
import { Screen } from '@/components/Screen';
import { SportWeekCard } from '@/components/SportWeekCard';
import { useHealthData } from '@/components/useHealthData';
import { loadSportWeek, type SportWeek } from '@/db/sportData';

export default function SportScreen() {
  const { load, syncing, sync } = useHealthData();
  const [week, setWeek] = useState<SportWeek | null>(null);
  const [error, setError] = useState(false);

  const refresh = useCallback(() => {
    loadSportWeek()
      .then((w) => {
        setWeek(w);
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
      ) : week ? (
        <SportWeekCard week={week} load={load} />
      ) : null}
    </Screen>
  );
}
