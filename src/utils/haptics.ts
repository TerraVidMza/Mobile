/**
 * Utilidad para Feedback Háptico en Campo (UX Agrícola).
 *
 * Provee confirmación táctil para operarios usando guantes o bajo sol intenso.
 * En Web y plataformas no compatibles, falla silenciosamente.
 *
 * Las funciones son "fire and forget": devuelven void y absorben cualquier
 * rechazo, así la vibración nunca demora ni rompe el flujo de la pantalla
 * (y los llamadores no dejan promesas flotantes, regla Sonar S9383).
 */

import { Platform } from 'react-native';

function vibrar(accion: (Haptics: typeof import('expo-haptics')) => Promise<void>): void {
  if (Platform.OS === 'web') return;
  try {
    const Haptics = require('expo-haptics');
    accion(Haptics).catch(() => {
      // Ignorar en entornos no soportados
    });
  } catch {
    // Ignorar si el módulo nativo no está disponible
  }
}

export const haptics = {
  /** Confirmación de éxito al guardar registro (vibración media/fuerte). */
  success(): void {
    vibrar((H) => H.notificationAsync(H.NotificationFeedbackType.Success));
  },

  /** Notificación de error o conflicto de validación. */
  error(): void {
    vibrar((H) => H.notificationAsync(H.NotificationFeedbackType.Error));
  },

  /** Feedback ligero al seleccionar elementos de catálogo. */
  selection(): void {
    vibrar((H) => H.selectionAsync());
  },
};
