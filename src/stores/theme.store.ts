/**
 * Store de Tematización y Modo Solar de Alto Contraste — TerraVid Mobile.
 * Optimizado para lectura en fincas de Mendoza bajo sol directo.
 */

import { create } from 'zustand';
import { MD3LightTheme, MD3DarkTheme, MD3Theme } from 'react-native-paper';
import { secureStorage } from '../utils/storage';

export type ThemeMode = 'default' | 'dark' | 'solar';

const THEME_STORAGE_KEY = 'terravid_theme_mode';

export const solarTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#000000',
    onPrimary: '#FFFFFF',
    primaryContainer: '#F0F0F0',
    onPrimaryContainer: '#000000',
    surface: '#FFFFFF',
    onSurface: '#000000',
    background: '#FFFFFF',
    onBackground: '#000000',
    outline: '#000000',
  },
};

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => Promise<void>;
  getTheme: () => MD3Theme;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'default',

  setMode: async (mode: ThemeMode) => {
    await secureStorage.setItem(THEME_STORAGE_KEY, mode);
    set({ mode });
  },

  getTheme: () => {
    const currentMode = get().mode;
    if (currentMode === 'solar') {
      return solarTheme;
    }
    if (currentMode === 'dark') {
      return MD3DarkTheme;
    }
    return MD3LightTheme;
  },
}));
