/**
 * Auth Layout — stack navigator para pantallas de autenticación.
 * Estas pantallas son públicas (no requieren JWT).
 */

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen
        name="reset-password"
        options={{ headerShown: true, title: 'Restablecer contraseña' }}
      />
    </Stack>
  );
}
