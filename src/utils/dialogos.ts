/**
 * Avisos y confirmaciones que funcionan también en la PWA — M-006.
 *
 * `Alert.alert` de React Native **no hace nada en react-native-web**: en la
 * versión web guardar una labor no volvía a la lista (el `router.back()` estaba
 * en el botón del alerta) y "Eliminar registro" no eliminaba nada. Estas dos
 * funciones devuelven promesas y usan `window.alert` / `window.confirm` en web.
 */

import { Alert, Platform } from 'react-native';

export function avisar(titulo: string, mensaje: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.alert(`${titulo}\n\n${mensaje}`);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    Alert.alert(titulo, mensaje, [{ text: 'Aceptar', onPress: () => resolve() }], {
      cancelable: true,
      onDismiss: () => resolve(),
    });
  });
}

export function confirmar(opciones: {
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  destructivo?: boolean;
}): Promise<boolean> {
  const { titulo, mensaje, textoConfirmar = 'Aceptar', destructivo = false } = opciones;
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${titulo}\n\n${mensaje}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      titulo,
      mensaje,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        {
          text: textoConfirmar,
          style: destructivo ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
