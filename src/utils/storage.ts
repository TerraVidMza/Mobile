/**
 * Almacenamiento seguro multiplataforma.
 *
 * - En Android / iOS: utiliza expo-secure-store (Keychain / Keystore cifrado).
 * - En Web: utiliza window.localStorage como fallback seguro.
 */

import { Platform } from 'react-native';

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem(key)
          : null;
      } catch {
        return null;
      }
    }

    const SecureStore = require('expo-secure-store');
    return SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
      } catch {
        // Fallback
      }
      return;
    }

    const SecureStore = require('expo-secure-store');
    return SecureStore.setItemAsync(key, value);
  },

  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
      } catch {
        // Fallback
      }
      return;
    }

    const SecureStore = require('expo-secure-store');
    return SecureStore.deleteItemAsync(key);
  },
};
