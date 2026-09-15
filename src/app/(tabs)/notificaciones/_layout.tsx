/**
 * Stack interno del tab Notificaciones. Ver `pesaje/_layout.tsx` para el porqué.
 * Hoy es de una sola pantalla, pero sin este layout web la sigue mostrando
 * como "notificaciones/index" en vez del título de `(tabs)/_layout.tsx`.
 */
import { Stack } from 'expo-router';

export default function NotificacionesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
