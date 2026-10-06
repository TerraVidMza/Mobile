/**
 * Ajustes de la app en campo — M-007, M-008.
 *
 * Desbloqueo con huella, modo solar (alto contraste para leer bajo el sol) y
 * respaldo de los registros del teléfono.
 */

import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Card, Divider, Switch, Text, useTheme } from 'react-native-paper';
import { useAuthStore } from '../../stores/auth.store';
import { useThemeStore } from '../../stores/theme.store';
import { BiometricsService } from '../../services/biometrics.service';
import { compartirRespaldo } from '../../utils/backup';
import { avisar } from '../../utils/dialogos';

function Fila({
  titulo,
  detalle,
  children,
}: {
  titulo: string;
  detalle: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.fila}>
      <View style={{ flex: 1 }}>
        <Text variant="titleSmall">{titulo}</Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {detalle}
        </Text>
      </View>
      {children}
    </View>
  );
}

export function AjustesCampo() {
  const user = useAuthStore((s) => s.user);
  const { mode, setMode } = useThemeStore();
  const [biometriaDisponible, setBiometriaDisponible] = useState(false);
  const [biometriaActiva, setBiometriaActiva] = useState(false);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    void (async () => {
      setBiometriaDisponible(await BiometricsService.estaDisponible());
      setBiometriaActiva(await BiometricsService.estaHabilitada());
    })();
  }, []);

  async function alternarBiometria(activar: boolean) {
    if (!activar) {
      await BiometricsService.deshabilitar();
      setBiometriaActiva(false);
      return;
    }
    const ok = await BiometricsService.habilitar(user?.email ?? 'usuario');
    setBiometriaActiva(ok);
    if (!ok) await avisar('Desbloqueo con huella', 'No se pudo verificar tu identidad.');
  }

  async function exportar() {
    setExportando(true);
    try {
      const backup = await compartirRespaldo();
      await avisar(
        'Respaldo generado',
        `${backup.totalLabores} labores y ${backup.totalPesajes} pesajes` +
          (backup.pendientes > 0 ? `, ${backup.pendientes} sin sincronizar.` : '.'),
      );
    } catch {
      await avisar('Respaldo', 'No se pudo generar el respaldo.');
    } finally {
      setExportando(false);
    }
  }

  return (
    <Card style={styles.card}>
      <Card.Title title="Ajustes" />
      <Card.Content>
        {biometriaDisponible && (
          <>
            <Fila
              titulo="Desbloqueo con huella"
              detalle="Al abrir la app pide la huella en vez de la contraseña."
            >
              <Switch
                value={biometriaActiva}
                onValueChange={(v) => void alternarBiometria(v)}
                accessibilityLabel="Desbloqueo con huella"
              />
            </Fila>
            <Divider />
          </>
        )}
        <Fila titulo="Modo solar" detalle="Alto contraste para leer la pantalla bajo el sol.">
          <Switch
            value={mode === 'solar'}
            onValueChange={(v) => void setMode(v ? 'solar' : 'default')}
            accessibilityLabel="Modo solar"
          />
        </Fila>
        <Divider />
        <Fila
          titulo="Respaldo"
          detalle="Exporta todos los registros del teléfono, incluidos los no sincronizados."
        >
          <Button mode="outlined" compact onPress={() => void exportar()} loading={exportando}>
            Exportar
          </Button>
        </Fila>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 12,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
});
