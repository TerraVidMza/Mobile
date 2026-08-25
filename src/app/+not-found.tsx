/**
 * 404 Screen — Ruta no encontrada.
 */

import { View, StyleSheet } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { Link, Stack } from 'expo-router';

export default function NotFoundScreen() {
  const theme = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: 'No encontrado' }} />
      <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
        <Text variant="headlineMedium" style={{ color: theme.colors.primary, fontWeight: '700' }}>
          Página no encontrada
        </Text>
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurfaceVariant, marginTop: 8, textAlign: 'center' }}
        >
          La pantalla a la que intentás acceder no existe o fue movida.
        </Text>
        <Link href="/(tabs)" asChild>
          <Button mode="contained" style={{ marginTop: 24, borderRadius: 12 }}>
            Volver al inicio
          </Button>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
});
