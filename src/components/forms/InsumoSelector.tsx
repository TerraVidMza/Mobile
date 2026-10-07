/**
 * Componente Selector de Insumos — HU-13.
 *
 * Permite agregar N insumos a una labor antes de guardar.
 * Criterios:
 * - Muestra solo insumos activos del catálogo local.
 * - Validación: cantidad > 0, sin insumos duplicados en la misma labor (máx 20).
 * - Lista visual con botón de eliminar.
 */

import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  IconButton,
  Card,
  Menu,
  HelperText,
  useTheme,
} from 'react-native-paper';
import type { Insumo, DetalleInsumoDto } from '../../types/api.types';

interface InsumoSelectorProps {
  insumosDisponibles: Insumo[];
  insumosSeleccionados: DetalleInsumoDto[];
  onAddInsumo: (insumo: DetalleInsumoDto) => void;
  onRemoveInsumo: (insumoId: string) => void;
}

export function InsumoSelector({
  insumosDisponibles,
  insumosSeleccionados,
  onAddInsumo,
  onRemoveInsumo,
}: InsumoSelectorProps) {
  const theme = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedInsumo, setSelectedInsumo] = useState<Insumo | null>(null);
  const [cantidad, setCantidad] = useState('');
  const [error, setError] = useState<string | null>(null);

  const insumosFiltrados = insumosDisponibles.filter(
    (i) => !insumosSeleccionados.some((s) => s.insumoId === i.id),
  );

  function handleAdd() {
    setError(null);
    if (!selectedInsumo) {
      setError('Seleccioná un insumo de la lista');
      return;
    }
    const cantNum = parseFloat(cantidad);
    if (isNaN(cantNum) || cantNum <= 0) {
      setError('La cantidad debe ser mayor a 0');
      return;
    }
    if (insumosSeleccionados.length >= 20) {
      setError('Máximo 20 insumos por labor');
      return;
    }

    onAddInsumo({
      insumoId: selectedInsumo.id,
      cantidad: cantNum,
    });

    setSelectedInsumo(null);
    setCantidad('');
  }

  function getInsumoNombre(insumoId: string): string {
    const item = insumosDisponibles.find((i) => i.id === insumoId);
    return item ? `${item.nombre} (${item.unidadMedida ?? 'u'})` : 'Insumo';
  }

  return (
    <View style={styles.container}>
      <Text variant="titleSmall" style={[styles.title, { color: theme.colors.onSurface }]}>
        Insumos utilizados (opcional)
      </Text>

      {/* Lista de insumos ya agregados */}
      {insumosSeleccionados.map((item) => (
        <Card key={item.insumoId} style={[styles.itemCard, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Card.Content style={styles.itemContent}>
            <View style={styles.itemInfo}>
              <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                {getInsumoNombre(item.insumoId)}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Cantidad: {item.cantidad}
              </Text>
            </View>
            <IconButton
              icon="delete-outline"
              iconColor={theme.colors.error}
              size={20}
              onPress={() => onRemoveInsumo(item.insumoId)}
            />
          </Card.Content>
        </Card>
      ))}

      {/* Formulario para agregar un insumo */}
      <View style={styles.addRow}>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Button
              mode="outlined"
              testID="selector-insumo"
              onPress={() => setMenuVisible(true)}
              style={styles.selectButton}
              contentStyle={{ justifyContent: 'flex-start' }}
            >
              {selectedInsumo
                ? `${selectedInsumo.nombre} (${selectedInsumo.unidadMedida ?? 'u'})`
                : 'Seleccionar insumo...'}
            </Button>
          }
        >
          {insumosFiltrados.length === 0 ? (
            <Menu.Item title="No hay más insumos disponibles" disabled />
          ) : (
            insumosFiltrados.map((insumo) => (
              <Menu.Item
                key={insumo.id}
                onPress={() => {
                  setSelectedInsumo(insumo);
                  setMenuVisible(false);
                }}
                title={`${insumo.nombre} (${insumo.unidadMedida ?? 'u'})`}
              />
            ))
          )}
        </Menu>

        <TextInput
          testID="input-insumo-cantidad"
          label="Cant."
          mode="outlined"
          keyboardType="decimal-pad"
          value={cantidad}
          onChangeText={setCantidad}
          style={styles.cantidadInput}
          dense
        />

        <Button
          mode="contained-tonal"
          testID="boton-agregar-insumo"
          onPress={handleAdd}
          disabled={!selectedInsumo || !cantidad}
          style={styles.addButton}
        >
          +
        </Button>
      </View>

      {error && (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  title: {
    fontWeight: '600',
    marginBottom: 8,
  },
  itemCard: {
    marginBottom: 6,
    borderRadius: 8,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  itemInfo: {
    flex: 1,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  selectButton: {
    flex: 2,
    borderRadius: 8,
  },
  cantidadInput: {
    flex: 1,
    height: 40,
  },
  addButton: {
    borderRadius: 8,
    minWidth: 44,
  },
});
