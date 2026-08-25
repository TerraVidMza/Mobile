/**
 * Pruebas unitarias para utilitario de hápticos (haptics.ts - 100% Cobertura).
 */

import { Platform } from 'react-native';
import { haptics } from './haptics';

const mockNotificationAsync = jest.fn().mockResolvedValue(undefined);
const mockSelectionAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-haptics', () => ({
  notificationAsync: mockNotificationAsync,
  selectionAsync: mockSelectionAsync,
  NotificationFeedbackType: {
    Success: 'success',
    Error: 'error',
  },
}));

describe('haptics utility (100% Coverage)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('En plataforma Web', () => {
    beforeEach(() => {
      (Platform as any).OS = 'web';
    });

    it('no debe ejecutar llamadas nativas en web', async () => {
      await haptics.success();
      await haptics.error();
      await haptics.selection();
      expect(mockNotificationAsync).not.toHaveBeenCalled();
      expect(mockSelectionAsync).not.toHaveBeenCalled();
    });
  });

  describe('En plataforma Nativa (iOS / Android)', () => {
    beforeEach(() => {
      (Platform as any).OS = 'ios';
    });

    it('debe ejecutar notificationAsync para success y error', async () => {
      await haptics.success();
      expect(mockNotificationAsync).toHaveBeenCalledWith('success');

      await haptics.error();
      expect(mockNotificationAsync).toHaveBeenCalledWith('error');

      await haptics.selection();
      expect(mockSelectionAsync).toHaveBeenCalled();
    });

    it('debe capturar errores de ejecución silenciosamente', async () => {
      mockNotificationAsync.mockRejectedValueOnce(new Error('Device not supported'));
      mockSelectionAsync.mockRejectedValueOnce(new Error('Device not supported'));

      await expect(haptics.success()).resolves.not.toThrow();
      await expect(haptics.error()).resolves.not.toThrow();
      await expect(haptics.selection()).resolves.not.toThrow();
    });
  });
});
