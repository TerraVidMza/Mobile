/**
 * Pantalla de Restablecer Contraseña — HU-03.
 *
 * Se accede con un token proveniente de un deep link o ingresado por el usuario.
 */

import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, HelperText, useTheme } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { resetPasswordSchema } from '../../utils/validators';
import { authService } from '../../services/auth.service';

interface ResetPasswordForm {
  token: string;
  newPassword: string;
}

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: params.token ?? '',
      newPassword: '',
    },
  });

  async function onSubmit(data: ResetPasswordForm) {
    setIsSubmitting(true);
    setServerError(null);
    try {
      await authService.resetPassword({
        token: data.token,
        newPassword: data.newPassword,
      });
      setSuccess(true);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response: { data?: { message?: string } } };
        setServerError(
          axiosError.response.data?.message ??
            'El enlace expiró o ya fue utilizado. Solicitá uno nuevo.',
        );
      } else {
        setServerError('Error al conectar con el servidor.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.content}>
          <Text variant="headlineSmall" style={{ color: theme.colors.primary, textAlign: 'center' }}>
            ¡Contraseña actualizada!
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: 12 }}
          >
            Tu contraseña se actualizó correctamente. Ya podés iniciar sesión con tus nuevas credenciales.
          </Text>
          <Button
            mode="contained"
            onPress={() => router.replace('/(auth)/login')}
            style={{ marginTop: 24, borderRadius: 12 }}
          >
            Ir al inicio de sesión
          </Button>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.surface }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.primary }]}>
          Nueva contraseña
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 24 }}>
          Ingresá tu código o token recibido y tu nueva contraseña (mínimo 8 caracteres, letras y números).
        </Text>

        <Controller
          control={control}
          name="token"
          render={({ field: { onChange, onBlur, value } }) => (
            <View style={styles.field}>
              <TextInput
                label="Token / Código"
                mode="outlined"
                autoCapitalize="none"
                left={<TextInput.Icon icon="key-outline" />}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={!!errors.token}
                disabled={isSubmitting}
              />
              {errors.token && (
                <HelperText type="error" visible>
                  {errors.token.message}
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
          Restablecer contraseña
        </Button>

        <Button
          mode="text"
          onPress={() => router.replace('/(auth)/login')}
          disabled={isSubmitting}
          style={{ marginTop: 8 }}
        >
          Volver al login
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
