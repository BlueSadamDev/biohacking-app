// Onglet Coach (DESIGN.md, « Écrans du lot 4 »). Étape C4 : en-tête, badge, carte du bilan de la
// semaine (le plus récent) et lien vers l'historique. Les questions et la conversation viennent à
// l'étape C6. Le bilan dû est rédigé à l'ouverture de l'onglet : le modèle n'est chargé qu'ici,
// puis libéré. Sans modèle installé : une carte unique qui renvoie vers l'écran Modèle.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Card } from '@/components/Card';
import { PrivacyBadge, WeeklyReviewCard } from '@/components/CoachViews';
import { Screen } from '@/components/Screen';
import { colors } from '@/components/theme';
import { getInstalledModel } from '@/coach/modelStore';
import { generateDueWeeklyReview, type WeeklyJob } from '@/coach/weeklyService';
import { loadLatestWeeklyReview } from '@/db/coachWeekly';
import type { WeeklyReview } from '@/domain/weeklyReview';

export default function CoachScreen() {
  const router = useRouter();
  const [installed, setInstalled] = useState(() => getInstalledModel() !== null);
  const [latest, setLatest] = useState<WeeklyReview | null>(null);
  const [writing, setWriting] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const job = useRef<WeeklyJob | null>(null);
  const busy = useRef(false);

  const refresh = useCallback(() => {
    const hasModel = getInstalledModel() !== null;
    setInstalled(hasModel);
    loadLatestWeeklyReview()
      .then(setLatest)
      .catch(() => setLatest(null));
    if (!hasModel || busy.current) return;
    // Bilan dû (dimanche, ou premier passage suivant) : rédigé maintenant, modèle libéré ensuite.
    busy.current = true;
    setError(null);
    generateDueWeeklyReview(
      (t) => {
        setWriting(true);
        setPartial(t);
      },
      (j) => {
        job.current = j;
      },
    )
      .then((review) => {
        if (review) setLatest(review);
      })
      .catch(() => setError("Le bilan de la semaine n'a pas pu être rédigé. Il sera réessayé à ta prochaine visite."))
      .finally(() => {
        busy.current = false;
        job.current = null;
        setWriting(false);
        setPartial('');
      });
  }, []);
  useFocusEffect(refresh);

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.titles}>
          <AppText variant="label">Ton coach Aube</AppText>
          <AppText variant="title">Coach</AppText>
        </View>
        <PrivacyBadge onPress={() => router.push('/coach-modele')} />
      </View>

      {!installed ? (
        <Card style={styles.intro}>
          <AppText variant="strong">Un coach qui explique tes chiffres</AppText>
          <AppText variant="bodySmall" style={styles.soft}>
            Chaque semaine, il fait le bilan de ce qui a marché et de ce qui coince, et propose 2 actions. Il répond
            aussi à tes questions. Il tourne entièrement sur ton téléphone, sans Internet, et n’invente aucun chiffre :
            les chiffres viennent de l’app.
          </AppText>
          <AppText variant="bodySmall" style={styles.soft}>
            Pour l’activer, installe une fois le fichier du modèle.
          </AppText>
          <PrimaryButton title="Installer le modèle du coach" onPress={() => router.push('/coach-modele')} />
        </Card>
      ) : (
        <>
          {writing && (
            <Card style={styles.intro}>
              <View style={styles.writingHead}>
                <ActivityIndicator color={colors.text} />
                <AppText variant="strong">Rédaction de ton bilan de la semaine…</AppText>
              </View>
              {partial ? (
                <AppText variant="bodySmall" style={styles.soft}>
                  {partial}
                </AppText>
              ) : null}
              <SecondaryButton title="Arrêter" onPress={() => job.current?.stop()} />
            </Card>
          )}
          {!writing && latest && <WeeklyReviewCard review={latest} />}
          {!writing && !latest && !error && (
            <AppText variant="bodySmall" style={styles.center}>
              Ton premier bilan arrivera dimanche.
            </AppText>
          )}
          {error && (
            <AppText variant="bodySmall" style={[styles.center, styles.soft]}>
              {error}
            </AppText>
          )}
          {latest && !writing && (
            <SecondaryButton title="Historique des bilans" onPress={() => router.push('/coach-bilans')} />
          )}
          <AppText style={styles.notice}>
            Le coach explique tes chiffres, il n’en invente pas. Ce n’est pas un avis médical.
          </AppText>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Le badge passe sous le titre si la place manque (grands textes du système).
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  titles: { gap: 2 },
  intro: { gap: 12 },
  writingHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  soft: { color: colors.textSoft },
  center: { textAlign: 'center' },
  notice: { fontSize: 11, color: colors.tabInactive, textAlign: 'center' },
});
