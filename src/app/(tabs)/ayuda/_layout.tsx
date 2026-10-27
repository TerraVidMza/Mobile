/**
 * Stack interno del tab Ayuda. Ver `pesaje/_layout.tsx` para el porqué.
 */
import { Stack } from 'expo-router';

export default function AyudaLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="soporte" options={{ headerShown: true, title: 'Pedir ayuda' }} />
    </Stack>
  );
}
