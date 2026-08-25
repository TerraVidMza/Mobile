/**
 * Pantalla de Recuperar Contraseña — HU-03.
 *
 * Criterios:
 * - El servidor responde siempre "Si el email existe, se enviaron las instrucciones".
 * - No revela si la cuenta existe o no.
 */

import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, HelperText, useTheme } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { forgotPasswordSchema } from '../../utils/validators';
import { authService } from '../../services/auth.service';

interface ForgotPasswordForm {
  email: string;
}

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(data: ForgotPasswordForm) {
    setIsSubmitting(true);
    try {
      await authService.forgotPassword(data);
      setSent(true);
    } catch {
      // Error de red — igual mostramos el mensaje genérico para no filtrar.
      setSent(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sent) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.content}>
          <Text variant="headlineSmall" style={{ color: theme.colors.primary, textAlign: 'center' }}>
            ¡Listo!
          </Text>
          <Text
            variant="bodyLarge"
            style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: 16 }}
          >
            Si el email existe, se enviaron las instrucciones de recuperación.
          </Text>
          <Button mode="contained" onPress={() => router.back()} style={{ marginTop: 32 }}>
            Volver al login
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
        <Text variant="headlineSmall" style={{ color: theme.colors.primary, marginBottom: 8 }}>
          Recuperar contraseña
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 32 }}>
          Ingresá tu email y te enviaremos las instrucciones para restablecerla.
        </Text>

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <View>
              <TextInput
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
                onSubmitEditing={handleSubmit(onSubmit)}
              />
              {errors.email && (
                <HelperText type="error" visible>
                  {errors.email.message}
                </HelperText>
              )}
            </View>
          )}
        />

        <Button
          mode="contained"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          disabled={isSubmitting}
          style={{ marginTop: 24, borderRadius: 12 }}
          contentStyle={{ paddingVertical: 8 }}
        >
          Enviar instrucciones
        </Button>

        <Button mode="text" onPress={() => router.back()} disabled={isSubmitting} style={{ marginTop: 8 }}>
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
});
