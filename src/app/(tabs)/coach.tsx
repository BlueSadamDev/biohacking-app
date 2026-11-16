// Onglet Coach (DESIGN.md, « Écrans du lot 4 ») : en-tête + badge, carte du bilan de la semaine
// (le plus récent, étape C4), questions suggérées, conversation, champ de question (étape C6).
// Le bilan dû est rédigé à l'ouverture de l'onglet. Pour les questions, le modèle est chargé à la
// première question et libéré quand on quitte l'onglet. Jamais deux modèles en même temps : pas de
// question pendant la rédaction du bilan. Sans modèle installé : une carte unique vers l'écran Modèle.
// Coach désactivé dans Réglages (étape C7) : une carte unique vers Réglages, rien n'est chargé.
// Le champ de question reste en bas, au-dessus du clavier ; la conversation défile jusqu'au dernier message.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Card } from '@/components/Card';
import {
  CoachAnswer,
  PrivacyBadge,
  QuestionBubble,
  QuestionInput,
  SuggestedQuestions,
  WeeklyReviewCard,
} from '@/components/CoachViews';
import { colors, space } from '@/components/theme';
import { ChatSession, lastChatRejections } from '@/coach/chatSession';
import { loadCoachContext } from '@/coach/contextLoader';
import { getInstalledModel } from '@/coach/modelStore';
import { generateDueWeeklyReview, type WeeklyJob } from '@/coach/weeklyService';
import { getUserSettings } from '@/db/appSettings';
import { loadExchanges } from '@/db/coachMessages';
import { loadLatestWeeklyReview } from '@/db/coachWeekly';
import type { CoachContext } from '@/domain/coachContext';
import { normalizeQuestion, suggestedQuestions, type CoachExchange } from '@/domain/coachQuestions';
import { SETTINGS } from '@/domain/settings';
import { COACH } from '@/domain/texts/coach';
import type { WeeklyReview } from '@/domain/weeklyReview';

export default function CoachScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [installed, setInstalled] = useState(() => getInstalledModel() !== null);
  /** Coach activé dans Réglages (null : pas encore lu). */
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [latest, setLatest] = useState<WeeklyReview | null>(null);
  const [writing, setWriting] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const job = useRef<WeeklyJob | null>(null);
  const busy = useRef(false);

  // Questions libres.
  const [exchanges, setExchanges] = useState<CoachExchange[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<{ question: string; partial: string } | null>(null);
  /** Version de développement seulement : pourquoi la dernière réponse a été refusée. */
  const [devReasons, setDevReasons] = useState<{ id: string; text: string } | null>(null);
  const session = useRef<ChatSession | null>(null);
  const context = useRef<CoachContext | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  /** Suivre le bas de la conversation (après une question, pendant la réponse). */
  const follow = useRef(false);

  const load = useCallback((hasModel: boolean) => {
    loadLatestWeeklyReview()
      .then(setLatest)
      .catch(() => setLatest(null));
    if (!hasModel) return;
    Promise.all([loadExchanges().catch(() => []), loadCoachContext().catch(() => null)]).then(([all, ctx]) => {
      setExchanges(all);
      context.current = ctx;
      setSuggestions(ctx ? suggestedQuestions(ctx, all) : [...SETTINGS.coach.questions.general]);
    });
    if (busy.current) return;
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
      .catch(() => setError(COACH.weeklyFailed))
      .finally(() => {
        busy.current = false;
        job.current = null;
        setWriting(false);
        setPartial('');
      });
  }, []);

  const refresh = useCallback(() => {
    const hasModel = getInstalledModel() !== null;
    setInstalled(hasModel);
    follow.current = false;
    // Coach désactivé dans Réglages : rien n'est chargé ni rédigé.
    getUserSettings()
      .then((u) => u.coachEnabled)
      .catch(() => true)
      .then((on) => {
        setEnabled(on);
        if (on) load(hasModel);
      });
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      // Sortie de l'onglet : la génération en cours s'arrête et le modèle des questions est libéré.
      return () => {
        // Bilan en cours : interrompu sans être enregistré (rédigé à la prochaine visite).
        job.current?.cancel().catch(() => undefined);
        session.current?.close().catch(() => undefined);
        session.current = null;
      };
    }, [refresh]),
  );

  const ask = useCallback(
    async (text: string) => {
      const question = normalizeQuestion(text);
      if (!question || pending || busy.current) return;
      setDraft('');
      setError(null);
      follow.current = true;
      setPending({ question, partial: '' });
      if (!session.current) session.current = new ChatSession();
      try {
        const exchange = await session.current.ask(question, (t) =>
          setPending((p) => (p ? { ...p, partial: t } : p)),
        );
        if (exchange) {
          const all = [...exchanges, exchange].slice(-SETTINGS.coach.questions.historyShown);
          setExchanges(all);
          if (__DEV__ && lastChatRejections.length) setDevReasons({ id: exchange.id, text: lastChatRejections.join('\n') });
          // Nouvelles suggestions : relances sur le sujet de cette question.
          if (context.current) setSuggestions(suggestedQuestions(context.current, all));
        }
      } catch {
        setError('Le coach n’a pas pu répondre. Réessaie dans un instant.');
      } finally {
        setPending(null);
      }
    },
    [pending, exchanges],
  );

  const stop = useCallback(() => {
    session.current?.stop().catch(() => undefined);
  }, []);

  return (
    <KeyboardAvoidingView style={styles.root} behavior="padding">
      <ScrollView
        ref={scroll}
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => follow.current && scroll.current?.scrollToEnd({ animated: true })}>
        <View style={styles.header}>
          <View style={styles.titles}>
            <AppText variant="label">Ton coach Aube</AppText>
            <AppText variant="title">Coach</AppText>
          </View>
          <PrivacyBadge onPress={() => router.push('/coach-modele')} />
        </View>

        {enabled === null ? null : !enabled ? (
          <Card style={styles.intro}>
            <AppText variant="strong">Le coach est désactivé</AppText>
            <AppText variant="bodySmall" style={styles.soft}>
              Pas de bilan de la semaine ni de réponse à tes questions tant qu’il est désactivé. Le modèle reste
              installé et ta conversation est gardée : tu peux le réactiver dans Réglages.
            </AppText>
            <SecondaryButton title="Ouvrir les Réglages" onPress={() => router.navigate('/reglages')} />
          </Card>
        ) : !installed ? (
          <Card style={styles.intro}>
            <AppText variant="strong">Un coach qui explique tes chiffres</AppText>
            <AppText variant="bodySmall" style={styles.soft}>
              Chaque semaine, il fait le bilan de ce qui a marché et de ce qui coince, et propose 2 actions. Il répond
              aussi à tes questions. Il tourne entièrement sur ton téléphone, sans Internet, et n’invente aucun
              chiffre : les chiffres viennent de l’app.
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
            {latest && !writing && (
              <SecondaryButton title="Historique des bilans" onPress={() => router.push('/coach-bilans')} />
            )}

            {exchanges.map((e) => (
              <View key={e.id} style={styles.exchange}>
                <QuestionBubble text={e.question} />
                {e.answer ? (
                  <CoachAnswer text={e.answer} facts={e.facts} />
                ) : (
                  <AppText variant="small">Réponse arrêtée.</AppText>
                )}
                {__DEV__ && devReasons?.id === e.id && (
                  <AppText variant="small" style={styles.soft}>
                    {`Contrôle (version de développement) :\n${devReasons.text}`}
                  </AppText>
                )}
              </View>
            ))}
            {pending && (
              <View style={styles.exchange}>
                <QuestionBubble text={pending.question} />
                {pending.partial ? (
                  <CoachAnswer text={pending.partial} facts={[]} />
                ) : (
                  <View style={styles.writingHead}>
                    <ActivityIndicator color={colors.text} />
                    <AppText variant="small">Le coach prépare sa réponse…</AppText>
                  </View>
                )}
              </View>
            )}
            {error && (
              <AppText variant="bodySmall" style={[styles.center, styles.soft]}>
                {error}
              </AppText>
            )}

            {!pending && <SuggestedQuestions questions={suggestions} onAsk={ask} disabled={writing} />}
            <AppText style={styles.notice}>Il répond à chaque question séparément, sans se souvenir des précédentes.</AppText>
          </>
        )}
      </ScrollView>

      {installed && enabled && (
        <View style={styles.inputBar}>
          <QuestionInput
            value={draft}
            onChange={setDraft}
            onSend={() => ask(draft)}
            onStop={stop}
            running={!!pending}
            maxLength={SETTINGS.coach.questions.maxLength}
          />
          <AppText style={styles.notice}>
            Le coach explique tes chiffres, il n’en invente pas. Ce n’est pas un avis médical.
          </AppText>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.screen, paddingBottom: 16, gap: space.block },
  // Le badge passe sous le titre si la place manque (grands textes du système).
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  titles: { gap: 2 },
  intro: { gap: 12 },
  writingHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exchange: { gap: 8 },
  soft: { color: colors.textSoft },
  center: { textAlign: 'center' },
  notice: { fontSize: 11, color: colors.tabInactive, textAlign: 'center' },
  inputBar: {
    paddingHorizontal: space.screen,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 6,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
  },
});
