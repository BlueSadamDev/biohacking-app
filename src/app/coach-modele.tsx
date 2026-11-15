// Modèle du coach (DESIGN.md, « Écrans du lot 4 ») : installation du modèle par import manuel
// du fichier, vérification (taille, empreinte SHA-256), état et suppression.
// Ouvert depuis Réglages > Coach. L'app ne télécharge jamais rien.

import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Card } from '@/components/Card';
import { LockIcon } from '@/components/Icons';
import { BackHeader, Screen } from '@/components/Screen';
import { SettingRow, SettingsGroup, SettingValue } from '@/components/SettingsControls';
import { colors, fonts } from '@/components/theme';
import {
  availableSpace,
  deleteModel,
  getInstalledModel,
  importModel,
  type ImportStep,
  type InstalledModel,
} from '@/coach/modelStore';
import { formatBytes, problemMessage, requiredFreeSpace } from '@/domain/coachModel';
import { SETTINGS } from '@/domain/settings';

const STEP_TEXT: Record<ImportStep, string> = {
  verifying: 'Vérification du fichier (empreinte)…',
  installing: 'Installation…',
};

export default function CoachModelScreen() {
  const router = useRouter();
  const [model, setModel] = useState<InstalledModel | null>(() => getInstalledModel());
  const [step, setStep] = useState<ImportStep | 'picking' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const choose = useCallback(async () => {
    setMessage(null);
    setStep('picking');
    try {
      const res = await importModel(setStep);
      if (res.kind === 'installed') setModel(res.model);
      if (res.kind === 'refused') {
        const free = availableSpace();
        setMessage(problemMessage(res.problem, free === null ? undefined : formatBytes(free)));
      }
    } catch {
      setMessage(problemMessage('unreadable'));
    } finally {
      setStep(null);
    }
  }, []);

  const confirmDelete = useCallback(() => {
    Alert.alert(
      'Supprimer le modèle ?',
      `Le coach ne fonctionnera plus tant que tu ne l'auras pas réinstallé. Cela libère ${formatBytes(model?.sizeBytes ?? SETTINGS.coach.model.sizeBytes)}.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            try {
              deleteModel();
              setModel(null);
              setMessage('Modèle supprimé.');
            } catch {
              setMessage('La suppression a échoué. Réessaie.');
            }
          },
        },
      ],
    );
  }, [model]);

  const free = availableSpace();

  return (
    <Screen bottomInset>
      <BackHeader title="Modèle du coach" onBack={() => router.back()} />

      <Card style={styles.privacy}>
        <LockIcon color={colors.good} />
        <View style={styles.privacyText}>
          <AppText variant="strong">Tout reste sur ton téléphone</AppText>
          <AppText variant="bodySmall" style={styles.soft}>
            Le coach fonctionne sans Internet : tes données ne quittent jamais le téléphone.
          </AppText>
        </View>
      </Card>

      {model ? (
        <>
          <SettingsGroup title="Modèle installé">
            <SettingRow label="État">
              <SettingValue text="Installé · prêt" color={colors.good} />
            </SettingRow>
            <SettingRow label="Modèle">
              <SettingValue text={model.label} />
            </SettingRow>
            <SettingRow label="Fichier" hint={model.name}>
              <SettingValue text={formatBytes(model.sizeBytes)} />
            </SettingRow>
            <SettingRow label="Vitesse mesurée">
              <SettingValue text="pas encore mesurée" color={colors.textMuted} />
            </SettingRow>
            <SettingRow label="Bilan de la semaine">
              <SettingValue text="dimanche, à l'ouverture du coach" />
            </SettingRow>
          </SettingsGroup>
          {SETTINGS.coach.alternativeModels.length > 0 && (
            // Comparaison : un autre modèle accepté remplace celui-ci (un seul installé à la fois).
            <SecondaryButton title="Changer de modèle (comparaison)" onPress={choose} />
          )}
          {step !== null && step !== 'picking' && (
            <AppText variant="small" style={styles.center}>
              {STEP_TEXT[step]}
            </AppText>
          )}
          <SecondaryButton title="Supprimer le modèle" color={colors.low} onPress={confirmDelete} />
        </>
      ) : (
        <>
          <Card>
            <AppText variant="label">Installer en 3 étapes</AppText>
            <Step n={1} text={`Sur l'ordinateur, télécharge le fichier ${SETTINGS.coach.model.fileName} (lien dans le README du projet).`} />
            <Step n={2} text="Copie-le dans le dossier Téléchargements du téléphone (câble USB, « Transfert de fichiers »)." />
            <Step n={3} text="Choisis-le ci-dessous : Aube le vérifie puis le range dans son espace privé." />
            <AppText variant="small" style={styles.sizes}>
              {`Taille : ${formatBytes(SETTINGS.coach.model.sizeBytes)} · espace nécessaire : ${formatBytes(requiredFreeSpace())}`}
              {free === null ? '' : ` · libre : ${formatBytes(free)}`}
            </AppText>
          </Card>
          <PrimaryButton title="Choisir le fichier du modèle" onPress={choose} busy={step !== null} />
          {step !== null && step !== 'picking' && (
            <AppText variant="small" style={styles.center}>
              {STEP_TEXT[step]}
            </AppText>
          )}
        </>
      )}

      {message && (
        <AppText variant="bodySmall" style={[styles.center, styles.soft]}>
          {message}
        </AppText>
      )}
    </Screen>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.step}>
      <AppText style={styles.stepNumber}>{n}</AppText>
      <AppText variant="bodySmall" style={[styles.soft, styles.stepText]}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  privacy: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  privacyText: { flex: 1, gap: 4 },
  soft: { color: colors.textSoft },
  step: { flexDirection: 'row', gap: 10, marginTop: 12 },
  stepNumber: { fontFamily: fonts.display600, fontSize: 15, color: colors.text, width: 16 },
  stepText: { flex: 1 },
  sizes: { marginTop: 14 },
  center: { textAlign: 'center' },
});
