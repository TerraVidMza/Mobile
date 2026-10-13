/**
 * Pantalla de desbloqueo biométrico — M-007.
 *
 * Se muestra al abrir la app con una sesión guardada y el desbloqueo activado.
 * Pide la huella sola al aparecer; si el usuario la cancela, puede reintentar o
 * entrar con la contraseña (cierra la sesión y va al login).
 */

import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../../stores/auth.store';
import { BiometricsService } from '../../services/biometrics.service';

export function PantallaBloqueo() {
  const theme = useTheme();
  const { desbloquear, logout, user } = useAuthStore();
  const [verificando, setVerificando] = useState(false);
  const [fallo, setFallo] = useState(false);

  const intentar = useCallback(async () => {
    setVerificando(true);
    const ok = await BiometricsService.autenticar();
    setVerificando(false);
    if (ok) desbloquear();
    else setFallo(true);
  }, [desbloquear]);

  useEffect(() => {
    void intentar();
  }, [intentar]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <MaterialCommunityIcons name="fingerprint" size={72} color={theme.colors.primary} />
      <Text variant="headlineSmall" style={styles.titulo}>
        TerraVid está bloqueado
      </Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
        {user?.email}
        {fallo ? '\nNo se pudo verificar tu identidad.' : ''}
      </Text>
      <Button
        mode="contained"
        icon="fingerprint"
        onPress={() => void intentar()}
        loading={verificando}
        disabled={verificando}
        style={styles.boton}
      >
        Desbloquear
      </Button>
      <Button mode="text" onPress={() => void logout()}>
        Ingresar con contraseña
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  titulo: {
    fontWeight: '700',
    marginTop: 8,
  },
  boton: {
    marginTop: 16,
    alignSelf: 'stretch',
    borderRadius: 12,
  },
});
