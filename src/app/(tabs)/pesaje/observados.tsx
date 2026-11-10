/**
 * Pesajes observados: los que quedaron así porque su remito fue rechazado.
 *
 * El Capataz los corrige acá (kilos y fecha) y vuelven a la cola de remitos.
 * Requiere conexión: el pesaje ya está en el servidor y se corrige allí.
 */

import { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import {
  Button,
  Card,
  Dialog,
  HelperText,
  Portal,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  pesajeObservadosService,
  type PesajeObservado,
} from '../../../services/pesaje.service';
import { haptics } from '../../../utils/haptics';

const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;

export default function PesajesObservadosScreen() {
  const theme = useTheme();
  const [items, setItems] = useState<PesajeObservado[]>([]);
  const [cargando, setCargando] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [editando, setEditando] = useState<PesajeObservado | null>(null);
  const [kg, setKg] = useState('');
  const [fecha, setFecha] = useState('');
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setItems(await pesajeObservadosService.listar());
      setErrorCarga(null);
    } catch {
      setErrorCarga('No se pudieron cargar los pesajes. Revisá tu conexión.');
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar]),
  );

  function abrir(item: PesajeObservado) {
    setEditando(item);
    setKg(String(item.kgTotales));
    setFecha(item.fecha.slice(0, 10));
    setErrorForm(null);
  }

  async function guardar() {
    if (!editando) return;
    const kilos = Number(kg.replace(',', '.'));
    if (!Number.isFinite(kilos) || kilos < 0.01) {
      setErrorForm('Ingresá unos kilos válidos (mayores a 0).');
      return;
    }
    if (!FECHA_VALIDA.test(fecha)) {
      setErrorForm('La fecha va como AAAA-MM-DD.');
      return;
    }
    setGuardando(true);
    try {
      await pesajeObservadosService.corregir(editando.id, { kgTotales: kilos, fecha });
      haptics.success();
      setEditando(null);
      await cargar();
    } catch (e) {
      haptics.error();
      const mensaje = (e as { response?: { data?: { message?: string } } }).response?.data
        ?.message;
      setErrorForm(mensaje ?? 'No se pudo guardar. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {errorCarga && (
        <HelperText type="error" visible style={styles.error}>
          {errorCarga}
        </HelperText>
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={
          cargando ? null : (
            <View style={styles.vacio}>
              <MaterialCommunityIcons
                name="check-circle-outline"
                size={48}
                color={theme.colors.outline}
              />
              <Text
                variant="bodyLarge"
                style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}
              >
                No hay pesajes para corregir
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                {Number(item.kgTotales).toLocaleString('es-AR')} kg · {item.fecha.slice(0, 10)}
              </Text>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}
              >
                {item.cuartel?.finca?.nombre ? `${item.cuartel.finca.nombre} · ` : ''}
                {item.cuartel?.nombre ?? 'Cuartel'} · {item.cuadrilla?.nombre ?? 'Cuadrilla'}
              </Text>
              {item.remito?.motivoRechazo && (
                <Text
                  variant="bodySmall"
                  style={[styles.motivo, { backgroundColor: theme.colors.errorContainer }]}
                >
                  {item.remito.numeroRemito} rechazado: {item.remito.motivoRechazo}
                </Text>
              )}
              <Button
                mode="outlined"
                icon="pencil-outline"
                style={styles.boton}
                onPress={() => abrir(item)}
              >
                Corregir
              </Button>
            </Card.Content>
          </Card>
        )}
      />

      <Portal>
        <Dialog visible={editando !== null} onDismiss={() => !guardando && setEditando(null)}>
          <Dialog.Title>Corregir pesaje</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Total cosechado (kg)"
              mode="outlined"
              keyboardType="decimal-pad"
              value={kg}
              onChangeText={setKg}
              style={styles.campo}
            />
            <TextInput
              label="Fecha (AAAA-MM-DD)"
              mode="outlined"
              value={fecha}
              onChangeText={setFecha}
              style={styles.campo}
            />
            {errorForm && (
              <HelperText type="error" visible>
                {errorForm}
              </HelperText>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditando(null)} disabled={guardando}>
              Cancelar
            </Button>
            <Button mode="contained" onPress={guardar} loading={guardando} disabled={guardando}>
              Guardar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  lista: { padding: 16, paddingBottom: 32 },
  card: { marginBottom: 12, borderRadius: 12 },
  motivo: { marginTop: 8, padding: 8, borderRadius: 8 },
  boton: { marginTop: 12, borderRadius: 12 },
  campo: { marginBottom: 8 },
  vacio: { alignItems: 'center', paddingTop: 48 },
  error: { textAlign: 'center' },
});
