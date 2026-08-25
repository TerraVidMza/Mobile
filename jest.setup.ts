/**
 * Jest Setup & Teardown Configuration — TerraVid Mobile
 * Limpia timers y filtra advertencias internas de librerías UI de terceros en Node.
 */

// Silenciar warnings de act(...) producidos exclusivamente por animaciones internas de librerías de terceros
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('was not wrapped in act(...)') ||
      args[0].includes('transform-origin') ||
      args[0].includes('pointer-events'))
  ) {
    return;
  }
  originalConsoleError(...args);
};

// Silenciar advertencias de deprecación de estilos internos de react-native-web
const originalConsoleWarn = console.warn;
console.warn = (...args: any[]) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('pointerEvents is deprecated') ||
      args[0].includes('shadow*') ||
      args[0].includes('boxShadow'))
  ) {
    return;
  }
  originalConsoleWarn(...args);
};

afterEach(() => {
  jest.clearAllTimers();
});
