/**
 * Chip de estado de sincronización de un registro local (HU-14, M-003).
 *
 * Un registro solo está sincronizado o pendiente. Si tuvo intentos fallidos
 * se muestra como "Reintentando" para que el capataz abra el detalle y vea el
 * motivo; sigue subiendo solo cuando el problema se resuelve.
 */

import { Chip } from 'react-native-paper';
import { EstadoSync } from '../../types/api.types';

interface Props {
  estado: EstadoSync;
  errorMessage: string | null;
  intentos?: number;
}

export function EstadoSyncChip({ estado, errorMessage, intentos = 0 }: Props) {
  if (estado === EstadoSync.SINCRONIZADO) {
    return (
      <Chip
        icon="check-circle"
        textStyle={{ color: '#27AE60' }}
        style={{ backgroundColor: '#E8F5E9' }}
        compact
      >
        Sincronizado
      </Chip>
    );
  }

  if (errorMessage || intentos > 0) {
    return (
      <Chip
        icon="sync-alert"
        textStyle={{ color: '#C62828' }}
        style={{ backgroundColor: '#FFEBEE' }}
        compact
        accessibilityLabel={`Pendiente, ${intentos} intento(s) fallido(s)`}
      >
        Reintentando
      </Chip>
    );
  }

  return (
    <Chip
      icon="clock-outline"
      textStyle={{ color: '#E65100' }}
      style={{ backgroundColor: '#FFF3E0' }}
      compact
    >
      Pendiente
    </Chip>
  );
}
