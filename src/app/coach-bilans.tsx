// Historique des bilans de la semaine du coach (lot 4, étape C4), du plus récent au plus ancien.

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { WeeklyReviewCard } from '@/components/CoachViews';
import { BackHeader, Screen } from '@/components/Screen';
import { loadWeeklyReviews } from '@/db/coachWeekly';
import type { WeeklyReview } from '@/domain/weeklyReview';

export default function CoachReviewsScreen() {
  const router = useRouter();
  const [reviews, setReviews] = useState<WeeklyReview[] | null>(null);

  useEffect(() => {
    loadWeeklyReviews()
      .then(setReviews)
      .catch(() => setReviews([]));
  }, []);

  return (
    <Screen bottomInset>
      <BackHeader title="Bilans de la semaine" onBack={() => router.back()} />
      {reviews?.length === 0 && (
        <AppText variant="bodySmall" style={styles.center}>
          Aucun bilan pour l’instant. Le premier arrivera dimanche.
        </AppText>
      )}
      {reviews?.map((r) => <WeeklyReviewCard key={r.weekStart} review={r} />)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
});
