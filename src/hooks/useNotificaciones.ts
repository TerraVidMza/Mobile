/**
 * Hook para Gestión de Notificaciones Push (FCM / expo-notifications) — HU-35.
 *
 * Solicita permisos, obtiene el token de FCM y lo registra en el backend.
 */

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { notificacionesService } from '../services/notificaciones.service';
import { useAuthStore } from '../stores/auth.store';

// Configura el comportamiento cuando llega una notificación en primer plano (solo en plataformas nativas)
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // `shouldShowAlert` quedó obsoleto en expo-notifications 0.31: lo reemplazan
      // `shouldShowBanner` y `shouldShowList`.
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
  });
}

export function useNotificaciones() {
  const { isAuthenticated } = useAuthStore();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || Platform.OS === 'web') return;

    async function registerForPush() {
      if (!Device.isDevice) {
        return;
      }

      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          return;
        }

        const tokenData = await Notifications.getDevicePushTokenAsync();
        const token = tokenData.data;
        setExpoPushToken(token);

        const plataforma = Platform.OS === 'ios' ? 'ios' : 'android';
        await notificacionesService.registrarDeviceToken(token, plataforma);
      } catch {
        // En caso de fallo silencioso
      }
    }

    void registerForPush();
  }, [isAuthenticated]);

  return { expoPushToken };
}
