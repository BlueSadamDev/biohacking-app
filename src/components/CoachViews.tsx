// Composants du coach (DESIGN.md, « Écrans du lot 4 ») : badge « 100 % sur ton téléphone »,
// carte « Bilan de la semaine », lien « Pourquoi ? », bulle de réponse et panneau du bas.

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { explain, type ExplainJob } from '@/coach/explainService';
import type { CoachTask } from '@/domain/coachPrompt';
import type { CoachOutcome } from '@/domain/coachRun';
import type { WeeklyReview } from '@/domain/weeklyReview';

import { AppText } from './AppText';
import { SecondaryButton } from './Buttons';
import { formatShortDate } from './format';
import { LockIcon, SendIcon, StopIcon } from './Icons';
import { colors, fonts, radius, TOUCH } from './theme';

/** Lien « Pourquoi ? » en bas d'une carte alerte ou lien observé (masqué sans modèle : à l'appelant). */
export function WhyLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Pourquoi ? Explication du coach"
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [styles.why, pressed && { opacity: 0.7 }]}>
      <AppText style={styles.whyText}>Pourquoi ?</AppText>
    </Pressable>
  );
}

/** Bulle de réponse du coach : explication (14), lignes « Action : » (14/600), chiffres utilisés (11). */
export function CoachAnswer({ text, facts }: { text: string; facts: string[] }) {
  const lines = text.split('\n').filter((l) => l.trim());
  // « Chiffres utilisés » repliés par défaut : un appui les affiche.
  const [showFacts, setShowFacts] = useState(false);
  return (
    <View style={styles.bubble}>
      {lines.map((l, i) => (
        <AppText key={i} style={/^\s*action\s*:/i.test(l) ? styles.answerAction : styles.answer}>
          {l}
        </AppText>
      ))}
      {facts.length > 0 && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showFacts }}
            hitSlop={10}
            onPress={() => setShowFacts((v) => !v)}
            style={({ pressed }) => [styles.factsToggle, pressed && { opacity: 0.7 }]}>
            <AppText style={styles.factsToggleText}>
              {showFacts ? 'Masquer les chiffres utilisés' : 'Voir les chiffres utilisés'}
            </AppText>
          </Pressable>
          {showFacts && <AppText style={styles.facts}>{facts.join(' ')}</AppText>}
        </>
      )}
    </View>
  );
}

/** Bulle de question (à droite) : fond track, rayon 16 16 4 16, largeur maximale 80 %. */
export function QuestionBubble({ text }: { text: string }) {
  return (
    <View style={styles.question}>
      <AppText style={styles.answer}>{text}</AppText>
    </View>
  );
}

/** Questions suggérées : mêmes pastilles que les filtres (contour border, texte textSoft). */
export function SuggestedQuestions({ questions, onAsk, disabled }: { questions: string[]; onAsk: (q: string) => void; disabled?: boolean }) {
  return (
    <View style={styles.chips}>
      {questions.map((q) => (
        <Pressable
          key={q}
          accessibilityRole="button"
          accessibilityHint="Pose cette question au coach"
          disabled={disabled}
          onPress={() => onAsk(q)}
          style={({ pressed }) => [styles.chip, (pressed || disabled) && { opacity: 0.6 }]}>
          <AppText style={styles.chipText}>{q}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Champ de question : champ de 48 px + bouton carré 48 × 48 (fond text, flèche bg), « Envoyer » ;
 * pendant la rédaction, le bouton devient « Arrêter ».
 */
export function QuestionInput({
  value,
  onChange,
  onSend,
  onStop,
  running,
  maxLength,
}: {
  value: string;
  onChange: (t: string) => void;
  onSend: () => void;
  onStop: () => void;
  running: boolean;
  maxLength: number;
}) {
  return (
    <View style={styles.inputRow}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Pose ta question au coach"
        placeholderTextColor={colors.tabInactive}
        style={styles.input}
        maxLength={maxLength}
        returnKeyType="send"
        onSubmitEditing={onSend}
        editable={!running}
        accessibilityLabel="Question au coach"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={running ? 'Arrêter' : 'Envoyer'}
        onPress={running ? onStop : onSend}
        style={({ pressed }) => [styles.send, pressed && { opacity: 0.7 }]}>
        {running ? <StopIcon color={colors.bg} /> : <SendIcon color={colors.bg} />}
      </Pressable>
    </View>
  );
}

export type WhyRequest = { task: CoachTask; date: string | null; title: string };

/** Panneau du bas « Pourquoi ? » : le modèle est chargé à l'ouverture et libéré à la fermeture. */
export function WhySheet({ request, onClose }: { request: WhyRequest | null; onClose: () => void }) {
  return (
    <Modal visible={!!request} transparent animationType="slide" onRequestClose={onClose}>
      {/* Contenu monté seulement pendant l'ouverture : chaque « Pourquoi ? » repart de zéro. */}
      {request && <WhyContent request={request} onClose={onClose} />}
    </Modal>
  );
}

function WhyContent({ request, onClose }: { request: WhyRequest; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [partial, setPartial] = useState('');
  const [outcome, setOutcome] = useState<CoachOutcome | null>(null);
  const [failed, setFailed] = useState(false);
  const job = useRef<ExplainJob | null>(null);

  useEffect(() => {
    let alive = true;
    explain(request.task, request.date, (t) => alive && setPartial(t), (j) => (job.current = j))
      .then((o) => alive && (o ? setOutcome(o) : setFailed(true)))
      .catch(() => alive && setFailed(true))
      .finally(() => {
        job.current = null;
      });
    return () => {
      // Fermeture : on arrête la génération ; le modèle est libéré par explain().
      alive = false;
      job.current?.stop().catch(() => undefined);
    };
  }, [request]);

  const running = !outcome && !failed;

  return (
    <>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <AppText variant="label">Pourquoi ?</AppText>
        <AppText variant="strong">{request.title}</AppText>
        <ScrollView style={styles.sheetBody} contentContainerStyle={styles.sheetContent}>
          {running && (
            <View style={styles.bubble}>
              {partial ? (
                <AppText style={styles.answer}>{partial}</AppText>
              ) : (
                <View style={styles.loading}>
                  <ActivityIndicator color={colors.text} />
                  <AppText variant="small">Le coach prépare son explication…</AppText>
                </View>
              )}
            </View>
          )}
          {outcome &&
            (outcome.text ? (
              <CoachAnswer text={outcome.text} facts={outcome.facts} />
            ) : (
              <AppText variant="small">Explication arrêtée.</AppText>
            ))}
          {failed && <AppText variant="small">Le coach n’a pas pu répondre. Vérifie l’écran « Modèle du coach ».</AppText>}
        </ScrollView>
        <AppText style={styles.notice}>Le coach explique tes chiffres, il n’en invente pas. Ce n’est pas un avis médical.</AppText>
        {running ? (
          <SecondaryButton title="Arrêter" onPress={() => job.current?.stop()} />
        ) : (
          <SecondaryButton title="Fermer" onPress={onClose} />
        )}
      </View>
    </>
  );
}

/** Badge : pilule de 32 px, fond surface, cadenas 14 px + texte 12 textSoft. Ouvre l'écran Modèle. */
export function PrivacyBadge({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="100 % sur ton téléphone : ouvrir le modèle du coach"
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.badge, pressed && { opacity: 0.7 }]}>
      <LockIcon size={14} color={colors.textSoft} />
      <AppText style={styles.badgeText}>100 % sur ton téléphone</AppText>
    </Pressable>
  );
}

/** Carte « Bilan de la semaine ». */
export function WeeklyReviewCard({ review }: { review: WeeklyReview }) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <AppText style={styles.label}>Bilan de la semaine</AppText>
        <AppText variant="small">
          {formatShortDate(review.weekStart)} – {formatShortDate(review.weekEnd)}
        </AppText>
      </View>
      <AppText style={styles.synthesis}>{review.synthesis}</AppText>
      {review.worked.length > 0 && <Line label="Ce qui a marché" color={colors.good} text={review.worked.join(' · ')} />}
      {review.stuck.length > 0 && <Line label="Ce qui coince" color={colors.mid} text={review.stuck.join(' · ')} />}
      <View style={styles.separator} />
      <AppText variant="small">
        {review.actions.length > 1 ? `Tes ${review.actions.length} actions pour la semaine` : 'Ton action pour la semaine'}
      </AppText>
      {review.actions.map((a, i) => (
        <AppText key={i} style={styles.action}>
          {i + 1}. {a}
        </AppText>
      ))}
      {review.facts.length > 0 && <AppText style={styles.facts}>D’après : {review.facts.join(' · ')}</AppText>}
      {review.source === 'app' && (
        <AppText style={styles.facts}>Rédigé par l’app : le coach n’a pas pu formuler de conseil sûr cette fois.</AppText>
      )}
    </View>
  );
}

function Line({ label, color, text }: { label: string; color: string; text: string }) {
  return (
    <AppText style={styles.line}>
      <AppText style={[styles.lineLabel, { color }]}>{label} · </AppText>
      {text}
    </AppText>
  );
}

const styles = StyleSheet.create({
  why: { minHeight: TOUCH, justifyContent: 'center', alignSelf: 'flex-start' },
  whyText: { fontFamily: fonts.body600, fontSize: 13, color: colors.infoText },
  bubble: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 14,
    gap: 8,
    maxWidth: '88%',
  },
  question: {
    alignSelf: 'flex-end',
    backgroundColor: colors.track,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 16,
    padding: 14,
    maxWidth: '80%',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  chipText: { fontFamily: fonts.body500, fontSize: 13, color: colors.textSoft },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: colors.text,
    fontFamily: fonts.body400,
    fontSize: 14,
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answer: { fontFamily: fonts.body400, fontSize: 14, color: colors.text },
  answerAction: { fontFamily: fonts.body600, fontSize: 14, color: colors.text },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: colors.surfaceAlt,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
    maxHeight: '80%',
  },
  sheetBody: { flexGrow: 0 },
  sheetContent: { gap: 12 },
  notice: { fontSize: 11, color: colors.tabInactive, textAlign: 'center' },
  badge: {
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: { fontFamily: fonts.body400, fontSize: 12, color: colors.textSoft },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, gap: 8 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: {
    fontFamily: fonts.body600,
    fontSize: 12,
    color: colors.infoText,
    textTransform: 'uppercase',
    letterSpacing: 12 * 0.08,
  },
  synthesis: { fontFamily: fonts.body600, fontSize: 15, color: colors.text },
  line: { fontFamily: fonts.body400, fontSize: 13, color: colors.textSoft },
  lineLabel: { fontFamily: fonts.body600, fontSize: 13 },
  separator: { height: 1, backgroundColor: colors.surfaceAlt, marginVertical: 4 },
  action: { fontFamily: fonts.body600, fontSize: 14, color: colors.text },
  facts: { fontFamily: fonts.body400, fontSize: 11, color: colors.tabInactive, marginTop: 4 },
  factsToggle: { alignSelf: 'flex-start', minHeight: 24, justifyContent: 'center', marginTop: 4 },
  factsToggleText: { fontFamily: fonts.body600, fontSize: 12, color: colors.infoText },
});
