/**
 * Pantalla de Cambio Obligatorio / Opcional de Contraseña — HU-04.
 */

import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, HelperText, useTheme } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { changePasswordSchema } from '../utils/validators';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../stores/auth.store';

interface ChangePasswordForm {
  currentPassword: string;
  newPassword: string;
}

export default function CambiarPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  async function onSubmit(data: ChangePasswordForm) {
    setIsSubmitting(true);
    setServerError(null);
    try {
      await authService.changePassword(data);
      // Actualiza estado y redirige
      if (user) {
        user.debeCambiarPassword = false;
      }
      router.replace('/(tabs)');
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response: { data?: { message?: string } } };
        setServerError(axiosError.response.data?.message ?? 'Error al cambiar la contraseña.');
      } else {
        setServerError('Error de conexión.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.surface }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.primary }]}>
          Cambiar contraseña
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 24 }}>
          Por seguridad, debés actualizar tu contraseña antes de continuar.
        </Text>

        <Controller
          control={control}
          name="currentPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <View style={styles.field}>
              <TextInput
                label="Contraseña actual"
                mode="outlined"
                secureTextEntry={!showCurrent}
                left={<TextInput.Icon icon="lock-outline" />}
                right={
                  <TextInput.Icon
                    icon={showCurrent ? 'eye-off' : 'eye'}
                    onPress={() => setShowCurrent(!showCurrent)}
                  />
                }
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={!!errors.currentPassword}
                disabled={isSubmitting}
              />
              {errors.currentPassword && (
                <HelperText type="error" visible>
                  {errors.currentPassword.message}
                </HelperText>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="newPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <View style={styles.field}>
              <TextInput
                label="Nueva contraseña"
                mode="outlined"
                secureTextEntry={!showNew}
                left={<TextInput.Icon icon="lock-plus-outline" />}
                right={
                  <TextInput.Icon
                    icon={showNew ? 'eye-off' : 'eye'}
                    onPress={() => setShowNew(!showNew)}
                  />
                }
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={!!errors.newPassword}
                disabled={isSubmitting}
                onSubmitEditing={handleSubmit(onSubmit)}
              />
              {errors.newPassword && (
                <HelperText type="error" visible>
                  {errors.newPassword.message}
                </HelperText>
              )}
            </View>
          )}
        />

        {serverError && (
          <HelperText type="error" visible style={{ textAlign: 'center', marginBottom: 12 }}>
            {serverError}
          </HelperText>
        )}

        <Button
          mode="contained"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          disabled={isSubmitting}
          style={styles.button}
          contentStyle={{ paddingVertical: 8 }}
        >
          Guardar nueva contraseña
        </Button>

        <Button
          mode="text"
          onPress={logout}
          disabled={isSubmitting}
          textColor={theme.colors.error}
          style={{ marginTop: 12 }}
        >
          Cancelar y cerrar sesión
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontWeight: '700',
    marginBottom: 8,
  },
  field: {
    marginBottom: 8,
  },
  button: {
    marginTop: 16,
    borderRadius: 12,
  },
});
