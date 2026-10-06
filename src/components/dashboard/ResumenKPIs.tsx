/**
 * Indicadores del día y avance de la cosecha — M-010.
 *
 * - Hoy: kilos pesados y labores cargadas en este teléfono.
 * - Campaña: kilos cosechados contra la meta que cargó el Propietario por
 *   cuartel (D-027). Antes la meta era 10.000 kg fija en el código.
 *
 * Sin señal muestra el último avance conocido más lo pesado y todavía no
 * sincronizado.
 */

import { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, ProgressBar, useTheme } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { avanceService, type AvanceCosecha } from '../../services/avance.service';
import { laboresRepo } from '../../db/repositories/labores.repo';
import { pesajesRepo } from '../../db/repositories/pesajes.repo';
import { hoyLocal } from '../../utils/fecha-local';

const kg = (n: number) => `${Math.round(n).toLocaleString('es-AR')} kg`;

interface Datos {
  kilosHoy: number;
  laboresHoy: number;
  avance: AvanceCosecha | null;
  pendientesKg: number;
  actualizadoAt: string | null;
}

export function ResumenKPIs() {
  const theme = useTheme();
  const [datos, setDatos] = useState<Datos | null>(null);

  useFocusEffect(
    useCallback(() => {
      let vigente = true;
      void (async () => {
        const hoy = hoyLocal();
        const [pesajes, labores, avance, pendientesKg] = await Promise.all([
          pesajesRepo.getPesajesByFecha(hoy),
          laboresRepo.getLaboresFiltered({ fecha: hoy }),
          avanceService.obtener(),
          avanceService.kilosPendientes(),
        ]);
        if (!vigente) return;
        setDatos({
          kilosHoy: pesajes.reduce((s, p) => s + p.pesoKg, 0),
          laboresHoy: labores.length,
          avance: avance.avance,
          pendientesKg,
          actualizadoAt: avance.actualizadoAt,
        });
      })();
      return () => {
        vigente = false;
      };
    }, []),
  );

  if (!datos) return null;
  const { avance } = datos;
  const cosechados = (avance?.kgCosechados ?? 0) + datos.pendientesKg;
  const meta = avance?.metaKg ?? null;
  const progreso = meta ? Math.min(cosechados / meta, 1) : 0;

  return (
    <Card style={styles.card}>
      <Card.Content>
        <Text variant="titleMedium" style={styles.titulo}>
          Resumen del día
        </Text>

        <View style={styles.fila}>
          <View style={styles.kpi}>
            <Text variant="headlineSmall" style={styles.valor}>
              {kg(datos.kilosHoy)}
            </Text>
            <Text variant="bodySmall" style={styles.etiqueta}>
              Pesados hoy
            </Text>
          </View>
          <View style={styles.kpi}>
            <Text variant="headlineSmall" style={styles.valor}>
              {datos.laboresHoy}
            </Text>
            <Text variant="bodySmall" style={styles.etiqueta}>
              Labores hoy
            </Text>
          </View>
        </View>

        {avance?.campania ? (
          <View>
            <View style={styles.encabezado}>
              <Text variant="bodySmall">Campaña {avance.campania.nombre}</Text>
              {meta !== null && (
                <Text variant="bodySmall" style={styles.valor}>
                  {Math.round(progreso * 100)}%
                </Text>
              )}
            </View>
            {meta !== null ? (
              <>
                <ProgressBar progress={progreso} color={theme.colors.primary} style={styles.barra} />
                <Text variant="bodySmall" style={styles.etiqueta}>
                  {kg(cosechados)} de {kg(meta)}
                  {datos.pendientesKg > 0 ? ` (incluye ${kg(datos.pendientesKg)} sin sincronizar)` : ''}
                </Text>
              </>
            ) : (
              <Text variant="bodySmall" style={styles.etiqueta}>
                {kg(cosechados)} cosechados. El Propietario todavía no cargó las metas.
              </Text>
            )}
          </View>
        ) : (
          <Text variant="bodySmall" style={styles.etiqueta}>
            {datos.actualizadoAt ? 'No hay una campaña en curso.' : 'El avance de la campaña se ve con señal.'}
          </Text>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 12, borderRadius: 12 },
  titulo: { fontWeight: '700', marginBottom: 12 },
  fila: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  kpi: { alignItems: 'center' },
  valor: { fontWeight: '700' },
  etiqueta: { opacity: 0.75 },
  encabezado: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  barra: { height: 8, borderRadius: 4, marginBottom: 6 },
});
