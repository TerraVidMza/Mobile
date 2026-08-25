/**
 * Utilidad para Feedback Háptico en Campo (UX Agrícola).
 *
 * Provee confirmación táctil para operarios usando guantes o bajo sol intenso.
 * En Web y plataformas no compatibles, falla silenciosamente.
 */

import { Platform } from 'react-native';

export const haptics = {
  /** Confirmación de éxito al guardar registro (vibración media/fuerte). */
  async success(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      const Haptics = require('expo-haptics');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Ignorar en entornos no soportados
    }
  },

  /** Notificación de error o conflicto de validación. */
  async error(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      const Haptics = require('expo-haptics');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {
      // Ignorar
    }
  },

  /** Feedback ligero al seleccionar elementos de catálogo. */
  async selection(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      const Haptics = require('expo-haptics');
      await Haptics.selectionAsync();
    } catch {
      // Ignorar
    }
  },
};
