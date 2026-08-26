/**
 * Componente de Respaldo y Métricas KPIs de Campo — TerraVid Mobile.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, ProgressBar, Button, useTheme } from 'react-native-paper';
import { useThemeStore } from '../../stores/theme.store';
import { generarBackupJson } from '../../utils/backup';

interface ResumenKPIsProps {
  kilosHoy?: number;
  metaKilos?: number;
  laboresHoy?: number;
  pendientesSync?: number;
  onExportSuccess?: (mensaje: string) => void;
}

export const ResumenKPIs: React.FC<ResumenKPIsProps> = ({
  kilosHoy = 0,
  metaKilos = 10000,
  laboresHoy = 0,
  pendientesSync = 0,
  onExportSuccess,
}) => {
  const theme = useTheme();
  const { mode, setMode } = useThemeStore();

  const progreso = metaKilos > 0 ? Math.min(kilosHoy / metaKilos, 1) : 0;
  const porcentaje = Math.round(progreso * 100);

  const handleExportBackup = async () => {
    try {
      const backup = await generarBackupJson();
      if (onExportSuccess) {
        onExportSuccess(`Respaldo generado con ${backup.totalLabores} labores y ${backup.totalPesajes} pesajes.`);
      }
    } catch {
      // Manejo silencioso en test/UI
    }
  };

  const toggleModoSolar = () => {
    setMode(mode === 'solar' ? 'default' : 'solar');
  };

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        <View style={styles.header}>
          <Text variant="titleMedium" style={styles.title}>
            Resumen Diario de Cosecha
          </Text>
          <Button
            mode={mode === 'solar' ? 'contained' : 'outlined'}
            compact
            onPress={toggleModoSolar}
            accessibilityLabel="Alternar Modo Solar de Alto Contraste"
          >
            {mode === 'solar' ? '☀️ Modo Solar' : '🌤️ Normal'}
          </Button>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiItem}>
            <Text variant="headlineSmall" style={styles.kpiValue}>
              {kilosHoy.toLocaleString()} kg
            </Text>
            <Text variant="bodySmall" style={styles.kpiLabel}>
              Cosechados Hoy
            </Text>
          </View>
          <View style={styles.kpiItem}>
            <Text variant="headlineSmall" style={styles.kpiValue}>
              {laboresHoy}
            </Text>
            <Text variant="bodySmall" style={styles.kpiLabel}>
              Labores Realizadas
            </Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text variant="bodySmall">Meta diaria: {metaKilos.toLocaleString()} kg</Text>
            <Text variant="bodySmall" style={styles.percentageText}>
              {porcentaje}%
            </Text>
          </View>
          <ProgressBar progress={progreso} color={theme.colors.primary} style={styles.progressBar} />
        </View>

        <View style={styles.footerRow}>
          <Text variant="bodySmall" style={styles.syncStatus}>
            {pendientesSync > 0 ? `⚠️ ${pendientesSync} pendientes de sincronizar` : '✅ Todo sincronizado'}
          </Text>
          <Button mode="text" compact onPress={handleExportBackup} accessibilityLabel="Generar Respaldo Local">
            💾 Guardar Respaldo
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontWeight: 'bold',
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  kpiItem: {
    alignItems: 'center',
  },
  kpiValue: {
    fontWeight: 'bold',
  },
  kpiLabel: {
    opacity: 0.7,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  percentageText: {
    fontWeight: 'bold',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
    paddingTop: 8,
  },
  syncStatus: {
    opacity: 0.8,
  },
});
