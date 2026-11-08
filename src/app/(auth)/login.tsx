/**
 * Pantalla de Login — HU-01.
 *
 * Criterios implementados:
 * - Validación local: email RFC 5322, contraseña no vacía (no se envía sin validar).
 * - Manejo de 401 (mensaje genérico), 429 (bloqueo 15 min).
 * - Al éxito: guarda token → redirige a tabs (el auth gate se encarga).
 * - Si debeCambiarPassword → redirige a cambiar-password.
 */

import { useState } from 'react';
import { View, Image, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, HelperText, IconButton, useTheme } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { loginSchema } from '../../utils/validators';
import { useAuthStore } from '../../stores/auth.store';
import { useThemeStore } from '../../stores/theme.store';

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginScreen() {
  const theme = useTheme();
  const setMode = useThemeStore((s) => s.setMode);
  const router = useRouter();
  const { login, loginError, clearLoginError } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(data: LoginForm) {
    setIsSubmitting(true);
    clearLoginError();
    try {
      await login(data.email, data.password);
      // El auth gate en _layout.tsx se encarga de redirigir.
    } catch {
      // El error ya está en loginError del store.
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.surface }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <IconButton
        testID="boton-tema"
        icon={theme.dark ? 'white-balance-sunny' : 'weather-night'}
        accessibilityLabel={theme.dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        onPress={() => void setMode(theme.dark ? 'light' : 'dark')}
        style={styles.botonTema}
      />
      <View style={styles.content}>
        {/* Logo / Branding */}
        <View style={styles.header}>
          {/* El logo ya trae el nombre y el lema escritos; en oscuro va sobre
              un panel blanco porque sus letras son violeta oscuro. */}
          <Image
            source={require('../../../assets/logo-completo.png')}
            accessibilityLabel="TerraVid"
            resizeMode="contain"
            style={[styles.logo, theme.dark && styles.logoOscuro]}
          />
        </View>

        {/* Formulario */}
        <View style={styles.form}>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.field}>
                <TextInput
                  testID="input-email"
                  label="Email"
                  mode="outlined"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  left={<TextInput.Icon icon="email-outline" />}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={!!errors.email}
                  disabled={isSubmitting}
                />
                {errors.email && (
                  <HelperText type="error" visible>
                    {errors.email.message}
                  </HelperText>
                )}
              </View>
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.field}>
                <TextInput
                  testID="input-password"
                  label="Contraseña"
                  mode="outlined"
                  secureTextEntry={!showPassword}
                  left={<TextInput.Icon icon="lock-outline" />}
                  right={
                    <TextInput.Icon
                      icon={showPassword ? 'eye-off' : 'eye'}
                      onPress={() => setShowPassword(!showPassword)}
                    />
                  }
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={!!errors.password}
                  disabled={isSubmitting}
                  onSubmitEditing={handleSubmit(onSubmit)}
                />
                {errors.password && (
                  <HelperText type="error" visible>
                    {errors.password.message}
                  </HelperText>
                )}
              </View>
            )}
          />

          {/* Error de login del servidor */}
          {loginError && (
            <HelperText type="error" visible style={styles.serverError}>
              {loginError}
            </HelperText>
          )}

          <Button
            testID="boton-ingresar"
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            disabled={isSubmitting}
            style={styles.button}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
          >
            Iniciar sesión
          </Button>

          <Button
            mode="text"
            onPress={() => router.push('/(auth)/forgot-password')}
            disabled={isSubmitting}
            style={styles.forgotButton}
          >
            ¿Olvidaste tu contraseña?
          </Button>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  botonTema: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 220,
    height: 195,
  },
  logoOscuro: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
  },
  form: {
    gap: 4,
  },
  field: {
    marginBottom: 8,
  },
  serverError: {
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 8,
  },
  button: {
    marginTop: 16,
    borderRadius: 12,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  forgotButton: {
    marginTop: 8,
  },
});
