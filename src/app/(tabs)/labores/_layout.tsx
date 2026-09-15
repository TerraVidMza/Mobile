/**
 * Stack interno del tab Labores. Ver `pesaje/_layout.tsx` para el porqué.
 */
import { Stack } from 'expo-router';

export default function LaboresLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="nueva" options={{ headerShown: true, title: 'Nueva labor' }} />
      <Stack.Screen name="[id]" options={{ headerShown: true, title: 'Detalle de labor' }} />
    </Stack>
  );
}
