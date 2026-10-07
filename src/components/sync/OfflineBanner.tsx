/**
 * Banner de Modo Offline.
 */

import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSyncStore } from '../../stores/sync.store';

export function OfflineBanner() {
  const theme = useTheme();
  const isConnected = useSyncStore((s) => s.isConnected);

  if (isConnected) return null;

  return (
    <View testID="banner-offline" style={[styles.banner, { backgroundColor: theme.colors.errorContainer }]}>
      <MaterialCommunityIcons name="wifi-off" size={20} color={theme.colors.onErrorContainer} />
      <Text variant="bodySmall" style={[styles.text, { color: theme.colors.onErrorContainer }]}>
        Sin conexión a internet. Los registros se guardarán en tu dispositivo y se sincronizarán al recuperar señal.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 12,
  },
  text: {
    flex: 1,
  },
});
