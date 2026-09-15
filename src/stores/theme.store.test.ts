/**
 * Pruebas unitarias para useThemeStore y Modo Solar.
 */

import { useThemeStore } from './theme.store';
import { secureStorage } from '../utils/storage';
import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

jest.mock('../utils/storage');

describe('Theme Store & Solar Mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useThemeStore.setState({ mode: 'default' });
  });

  it('debe retornar MD3LightTheme por defecto', () => {
    const theme = useThemeStore.getState().getTheme();
    expect(theme).toEqual(MD3LightTheme);
  });

  it('debe cambiar a modo solar de alto contraste y guardar en storage', async () => {
    await useThemeStore.getState().setMode('solar');
    expect(secureStorage.setItem).toHaveBeenCalledWith('terravid_theme_mode', 'solar');
    expect(useThemeStore.getState().mode).toBe('solar');

    const theme = useThemeStore.getState().getTheme();
    expect(theme.colors.primary).toBe('#000000');
    expect(theme.colors.background).toBe('#FFFFFF');
  });

  it('debe cambiar a modo oscuro', async () => {
    await useThemeStore.getState().setMode('dark');
    expect(useThemeStore.getState().mode).toBe('dark');
    expect(useThemeStore.getState().getTheme()).toEqual(MD3DarkTheme);
  });
});
