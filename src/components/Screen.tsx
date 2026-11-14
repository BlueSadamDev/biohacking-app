// Cadre commun des écrans : fond, marges de 20 px, défilement, zone sûre (encoche).

import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackIcon } from './Icons';
import { AppText } from './AppText';
import { RoundButton } from './Buttons';
import { colors, space } from './theme';

type Props = {
  children: React.ReactNode;
  /** Tirer vers le bas pour rafraîchir. */
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Sans barre d'onglets en bas, on ajoute la marge de la zone sûre. */
  bottomInset?: boolean;
};

export function Screen({ children, refreshing, onRefresh, bottomInset }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 12, paddingBottom: (bottomInset ? insets.bottom : 0) + 24 },
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
            colors={[colors.bg]}
            progressBackgroundColor={colors.text}
          />
        ) : undefined
      }>
      {children}
    </ScrollView>
  );
}

/** En-tête d'un écran secondaire : bouton retour + titre. */
export function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <RoundButton label="Retour" onPress={onBack}>
        <BackIcon />
      </RoundButton>
      <AppText variant="title" style={styles.headerTitle}>
        {title}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.screen, gap: space.block },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { flex: 1 },
});
