/**
 * Formulario de Registro de Labores — HU-12.
 *
 * Criterios implementados:
 * - 100% Offline-First: opera con datos de SQLite sin llamadas de red.
 * - Genera `local_uuid` con `expo-crypto` para garantizar idempotencia.
 * - Persiste en SQLite con estado_sync = 'pendiente'.
 * - Captura `createdAtLocal` en ISO 8601 con zona horaria local.
 * - Soporta multi-insumo con el componente InsumoSelector (HU-13).
 * - Incrementa badge de pendientes inmediatamente sin spinner de red.
 * - Feedback háptico en confirmación para uso con guantes.
 */

import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Menu,
  HelperText,
  useTheme,
  ActivityIndicator,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useCatalogosStore } from '../../../stores/catalogos.store';
import { useSyncStore } from '../../../stores/sync.store';
import { syncEngine } from '../../../sync/sync-engine';
import { laboresRepo } from '../../../db/repositories/labores.repo';
import { InsumoSelector } from '../../../components/forms/InsumoSelector';
import { hoyLocal, timestampLocal } from '../../../utils/fecha-local';
import { haptics } from '../../../utils/haptics';
import { EstadoSync } from '../../../types/api.types';
import type { Cuartel, DetalleInsumoDto } from '../../../types/api.types';
import { avisar } from '../../../utils/dialogos';

export default function NuevaLaborScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { fincas, tiposLabor, insumos, loadFromLocalDb, getCuartelesByFinca } =
    useCatalogosStore();
  const { incrementPending } = useSyncStore();

  // Estados del formulario
  const [selectedFincaId, setSelectedFincaId] = useState<string>('');
  const [cuartelesDisponibles, setCuartelesDisponibles] = useState<Cuartel[]>([]);
  const [selectedCuartelId, setSelectedCuartelId] = useState<string>('');
  const [selectedTipoLaborId, setSelectedTipoLaborId] = useState<string>('');
  const [fecha, setFecha] = useState<string>(hoyLocal());
  const [cantidad, setCantidad] = useState<string>('');
  const [insumosSeleccionados, setInsumosSeleccionados] = useState<DetalleInsumoDto[]>([]);

  // Menús desplegables
  const [fincaMenuVisible, setFincaMenuVisible] = useState(false);
  const [cuartelMenuVisible, setCuartelMenuVisible] = useState(false);
  const [tipoLaborMenuVisible, setTipoLaborMenuVisible] = useState(false);

  // Estados de control
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    async function init() {
      await loadFromLocalDb();
      setLoading(false);
    }
    init();
  }, [loadFromLocalDb]);

  // Al cambiar de finca, carga sus cuarteles
  useEffect(() => {
    if (selectedFincaId) {
      getCuartelesByFinca(selectedFincaId).then((cuarteles) => {
        setCuartelesDisponibles(cuarteles);
        setSelectedCuartelId('');
      });
    } else {
      setCuartelesDisponibles([]);
      setSelectedCuartelId('');
    }
  }, [selectedFincaId, getCuartelesByFinca]);

  function validate(): boolean {
    const newErrors: { [key: string]: string } = {};

    if (!selectedFincaId) newErrors.finca = 'Seleccioná una finca';
    if (!selectedCuartelId) newErrors.cuartel = 'Seleccioná un cuartel';
    if (!selectedTipoLaborId) newErrors.tipoLabor = 'Seleccioná un tipo de labor';
    if (!fecha) newErrors.fecha = 'La fecha es obligatoria';

    const cantNum = parseFloat(cantidad);
    if (isNaN(cantNum) || cantNum <= 0) {
      newErrors.cantidad = 'La cantidad debe ser mayor a 0';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      haptics.error();
      return false;
    }
    return true;
  }

  async function handleGuardar() {
    if (!validate()) return;

    setSaving(true);
    try {
      const localUuid = Crypto.randomUUID();
      const createdAtLocal = timestampLocal();

      await laboresRepo.createLabor(
        {
          localUuid,
          cuartelId: selectedCuartelId,
          tipoLaborId: selectedTipoLaborId,
          fecha,
          cantidad: parseFloat(cantidad),
          estadoSync: EstadoSync.PENDIENTE,
          errorMessage: null,
          createdAtLocal,
        },
        insumosSeleccionados,
      );

      incrementPending(1);
      // Con señal sube en el momento; sin señal queda pendiente (M-003).
      if (useSyncStore.getState().isConnected) void syncEngine.runSync();
      await haptics.success();

      // Con Alert.alert el `router.back()` no corría en la PWA (M-006).
      await avisar(
        'Labor guardada',
        'El registro se guardó en el teléfono y se sincroniza automáticamente.',
      );
      router.back();
    } catch {
      await haptics.error();
      void avisar('Error', 'No se pudo guardar el registro en el teléfono.');
    } finally {
      setSaving(false);
    }
  }

  const selectedFinca = fincas.find((f) => f.id === selectedFincaId);
  const selectedCuartel = cuartelesDisponibles.find((c) => c.id === selectedCuartelId);
  const selectedTipoLabor = tiposLabor.find((t) => t.id === selectedTipoLaborId);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.surface }]}
      contentContainerStyle={styles.content}
    >
      <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.primary }]}>
        Ubicación y Labor
      </Text>

      {/* Selector de Finca */}
      <View style={styles.field}>
        <Menu
          visible={fincaMenuVisible}
          onDismiss={() => setFincaMenuVisible(false)}
          anchor={
            <Button
              mode="outlined"
              onPress={() => {
                haptics.selection();
                setFincaMenuVisible(true);
              }}
              style={styles.dropdownButton}
              contentStyle={styles.dropdownContent}
            >
              {selectedFinca ? selectedFinca.nombre : 'Seleccionar Finca *'}
            </Button>
          }
        >
          {fincas.map((f) => (
            <Menu.Item
              key={f.id}
              onPress={() => {
                haptics.selection();
                setSelectedFincaId(f.id);
                setFincaMenuVisible(false);
              }}
              title={f.nombre}
            />
          ))}
        </Menu>
        {errors.finca && <HelperText type="error">{errors.finca}</HelperText>}
      </View>

      {/* Selector de Cuartel */}
      <View style={styles.field}>
        <Menu
          visible={cuartelMenuVisible}
          onDismiss={() => setCuartelMenuVisible(false)}
          anchor={
            <Button
              mode="outlined"
              onPress={() => {
                haptics.selection();
                setCuartelMenuVisible(true);
              }}
              disabled={!selectedFincaId}
              style={styles.dropdownButton}
              contentStyle={styles.dropdownContent}
            >
              {selectedCuartel
                ? `${selectedCuartel.nombre} ${selectedCuartel.variedad ? `(${selectedCuartel.variedad})` : ''}`
                : 'Seleccionar Cuartel *'}
            </Button>
          }
        >
          {cuartelesDisponibles.map((c) => (
            <Menu.Item
              key={c.id}
              onPress={() => {
                haptics.selection();
                setSelectedCuartelId(c.id);
                setCuartelMenuVisible(false);
              }}
              title={`${c.nombre} ${c.variedad ? `(${c.variedad})` : ''}`}
            />
          ))}
        </Menu>
        {errors.cuartel && <HelperText type="error">{errors.cuartel}</HelperText>}
      </View>

      {/* Selector de Tipo de Labor */}
      <View style={styles.field}>
        <Menu
          visible={tipoLaborMenuVisible}
          onDismiss={() => setTipoLaborMenuVisible(false)}
          anchor={
            <Button
              mode="outlined"
              onPress={() => {
                haptics.selection();
                setTipoLaborMenuVisible(true);
              }}
              style={styles.dropdownButton}
              contentStyle={styles.dropdownContent}
            >
              {selectedTipoLabor
                ? `${selectedTipoLabor.nombre} (${selectedTipoLabor.unidadMedida ?? 'u'})`
                : 'Seleccionar Tipo de Labor *'}
            </Button>
          }
        >
          {tiposLabor.map((t) => (
            <Menu.Item
              key={t.id}
              onPress={() => {
                haptics.selection();
                setSelectedTipoLaborId(t.id);
                setTipoLaborMenuVisible(false);
              }}
              title={`${t.nombre} (${t.unidadMedida ?? 'u'})`}
            />
          ))}
        </Menu>
        {errors.tipoLabor && <HelperText type="error">{errors.tipoLabor}</HelperText>}
      </View>

      {/* Fecha (Día local ISO YYYY-MM-DD) */}
      <View style={styles.field}>
        <TextInput
          label="Fecha (YYYY-MM-DD) *"
          mode="outlined"
          value={fecha}
          onChangeText={setFecha}
          error={!!errors.fecha}
          left={<TextInput.Icon icon="calendar" />}
        />
        {errors.fecha && <HelperText type="error">{errors.fecha}</HelperText>}
      </View>

      {/* Cantidad */}
      <View style={styles.field}>
        <TextInput
          label={`Cantidad realizada (${selectedTipoLabor?.unidadMedida ?? 'unidades'}) *`}
          mode="outlined"
          keyboardType="decimal-pad"
          value={cantidad}
          onChangeText={setCantidad}
          error={!!errors.cantidad}
          left={<TextInput.Icon icon="numeric" />}
        />
        {errors.cantidad && <HelperText type="error">{errors.cantidad}</HelperText>}
      </View>

      {/* Insumos (HU-13) */}
      <InsumoSelector
        insumosDisponibles={insumos}
        insumosSeleccionados={insumosSeleccionados}
        onAddInsumo={(insumo) => {
          haptics.selection();
          setInsumosSeleccionados((prev) => [...prev, insumo]);
        }}
        onRemoveInsumo={(insumoId) => {
          haptics.selection();
          setInsumosSeleccionados((prev) =>
            prev.filter((i) => i.insumoId !== insumoId),
          );
        }}
      />

      {/* Botón Guardar Local */}
      <Button
        mode="contained"
        icon="content-save-outline"
        onPress={handleGuardar}
        loading={saving}
        disabled={saving}
        style={styles.saveButton}
        contentStyle={styles.saveButtonContent}
      >
        Guardar (Local)
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 16,
  },
  field: {
    marginBottom: 12,
  },
  dropdownButton: {
    borderRadius: 8,
  },
  dropdownContent: {
    justifyContent: 'flex-start',
    paddingVertical: 6,
  },
  saveButton: {
    marginTop: 24,
    borderRadius: 12,
  },
  saveButtonContent: {
    paddingVertical: 8,
  },
});
