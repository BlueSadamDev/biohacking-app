// Carte « Force · 1RM estimé » de l'onglet Sport (DESIGN.md, « Écrans du lot 3 ») :
// 3 lignes d'exercice (squat, développé couché, soulevé de terre), « sur 12 semaines ».

import { StyleSheet, View } from 'react-native';

import type { ExerciseProgress } from '@/domain/strength';

import { AppText } from './AppText';
import { Card } from './Card';
import { StrengthRow } from './StrengthControls';

export function StrengthCard({ progress }: { progress: ExerciseProgress[] }) {
  const empty = progress.every((p) => p.weekly.every((v) => v === null));
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <AppText variant="label">Force · 1RM estimé</AppText>
        <AppText variant="small">sur 12 semaines</AppText>
      </View>
      {progress.map((p) => (
        <StrengthRow key={p.exercise} progress={p} />
      ))}
      {empty ? (
        <AppText variant="small">Saisis ta meilleure série après chaque séance pour suivre ta force.</AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
});
