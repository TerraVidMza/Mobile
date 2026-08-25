/**
 * Formulario de Registro de Pesaje Diario de Vendimia — HU-24.
 *
 * Criterios:
 * - Funciona 100% offline.
 * - Selectores para: Finca, Cuadrilla (solo activas), Cuartel (solo activos) y Fecha (hoy por defecto).
 * - Campo peso_kg con validación > 0 y hasta 2 decimales.
 * - Al confirmar: guarda en SQLite con estado 'pendiente', genera `local_uuid`.
 * - Incrementa badge de pendientes inmediatamente.
 * - Feedback háptico en confirmación.
 */

import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
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
import { pesajesRepo } from '../../../db/repositories/pesajes.repo';
import { hoyLocal, timestampLocal } from '../../../utils/fecha-local';
import { haptics } from '../../../utils/haptics';
import { EstadoSync } from '../../../types/api.types';
import type { Cuartel, Cuadrilla } from '../../../types/api.types';

export default function NuevoPesajeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { fincas, loadFromLocalDb, getCuartelesByFinca, getCuadrillasByFinca } =
    useCatalogosStore();
  const { incrementPending } = useSyncStore();

  const [selectedFincaId, setSelectedFincaId] = useState<string>('');
  const [cuartelesDisponibles, setCuartelesDisponibles] = useState<Cuartel[]>([]);
  const [cuadrillasDisponibles, setCuadrillasDisponibles] = useState<Cuadrilla[]>([]);
  const [selectedCuartelId, setSelectedCuartelId] = useState<string>('');
  const [selectedCuadrillaId, setSelectedCuadrillaId] = useState<string>('');
  const [fecha, setFecha] = useState<string>(hoyLocal());
  const [pesoKg, setPesoKg] = useState<string>('');

  const [fincaMenuVisible, setFincaMenuVisible] = useState(false);
  const [cuartelMenuVisible, setCuartelMenuVisible] = useState(false);
  const [cuadrillaMenuVisible, setCuadrillaMenuVisible] = useState(false);

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

  useEffect(() => {
    if (selectedFincaId) {
      getCuartelesByFinca(selectedFincaId).then(setCuartelesDisponibles);
      getCuadrillasByFinca(selectedFincaId).then(setCuadrillasDisponibles);
      setSelectedCuartelId('');
      setSelectedCuadrillaId('');
    } else {
      setCuartelesDisponibles([]);
      setCuadrillasDisponibles([]);
      setSelectedCuartelId('');
      setSelectedCuadrillaId('');
    }
  }, [selectedFincaId, getCuartelesByFinca, getCuadrillasByFinca]);

  function validate(): boolean {
    const newErrors: { [key: string]: string } = {};

    if (!selectedFincaId) newErrors.finca = 'Seleccioná una finca';
    if (!selectedCuadrillaId) newErrors.cuadrilla = 'Seleccioná una cuadrilla';
    if (!selectedCuartelId) newErrors.cuartel = 'Seleccioná un cuartel';
    if (!fecha) newErrors.fecha = 'La fecha es obligatoria';

    const pesoNum = parseFloat(pesoKg);
    if (isNaN(pesoNum) || pesoNum <= 0) {
      newErrors.pesoKg = 'El peso debe ser mayor a 0 kg';
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

      await pesajesRepo.createPesaje({
        localUuid,
        cuadrillaId: selectedCuadrillaId,
        cuartelId: selectedCuartelId,
        fecha,
        pesoKg: parseFloat(pesoKg),
        estadoSync: EstadoSync.PENDIENTE,
        errorMessage: null,
        createdAtLocal,
      });

      incrementPending(1);
      await haptics.success();

      Alert.alert(
        'Pesaje Guardado',
        'El pesaje se guardó localmente y se sincronizará automáticamente.',
        [{ text: 'Aceptar', onPress: () => router.back() }],
      );
    } catch {
      await haptics.error();
      Alert.alert('Error', 'No se pudo guardar el pesaje localmente.');
    } finally {
      setSaving(false);
    }
  }

  const selectedFinca = fincas.find((f) => f.id === selectedFincaId);
  const selectedCuartel = cuartelesDisponibles.find((c) => c.id === selectedCuartelId);
  const selectedCuadrilla = cuadrillasDisponibles.find((c) => c.id === selectedCuadrillaId);

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
        Datos de Cosecha
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

      {/* Selector de Cuadrilla */}
      <View style={styles.field}>
        <Menu
          visible={cuadrillaMenuVisible}
          onDismiss={() => setCuadrillaMenuVisible(false)}
          anchor={
            <Button
              mode="outlined"
              onPress={() => {
                haptics.selection();
                setCuadrillaMenuVisible(true);
              }}
              disabled={!selectedFincaId}
              style={styles.dropdownButton}
              contentStyle={styles.dropdownContent}
            >
              {selectedCuadrilla ? selectedCuadrilla.nombre : 'Seleccionar Cuadrilla *'}
            </Button>
          }
        >
          {cuadrillasDisponibles.map((c) => (
            <Menu.Item
              key={c.id}
              onPress={() => {
                haptics.selection();
                setSelectedCuadrillaId(c.id);
                setCuadrillaMenuVisible(false);
              }}
              title={c.nombre}
            />
          ))}
        </Menu>
        {errors.cuadrilla && <HelperText type="error">{errors.cuadrilla}</HelperText>}
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

      {/* Fecha */}
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

      {/* Peso en Kilogramos */}
      <View style={styles.field}>
        <TextInput
          label="Total cosechado (kg) *"
          mode="outlined"
          keyboardType="decimal-pad"
          value={pesoKg}
          onChangeText={setPesoKg}
          error={!!errors.pesoKg}
          left={<TextInput.Icon icon="scale" />}
        />
        {errors.pesoKg && <HelperText type="error">{errors.pesoKg}</HelperText>}
      </View>

      {/* Botón Guardar */}
      <Button
        mode="contained"
        icon="content-save-outline"
        onPress={handleGuardar}
        loading={saving}
        disabled={saving}
        style={styles.saveButton}
        contentStyle={styles.saveButtonContent}
      >
        Guardar Pesaje (Local)
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
