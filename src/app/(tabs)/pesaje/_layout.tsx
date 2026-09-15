/**
 * Stack interno del tab Pesaje.
 *
 * Sin este layout, Expo Router no puede colapsar `pesaje/index.tsx` y
 * `pesaje/nuevo.tsx` en una sola tab: en web las mostraba como rutas sueltas,
 * con el título crudo del archivo ("pesaje/index") en vez del que configura
 * `(tabs)/_layout.tsx`.
 */
import { Stack } from 'expo-router';

export default function PesajeLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="nuevo" options={{ headerShown: true, title: 'Nuevo pesaje' }} />
    </Stack>
  );
}
