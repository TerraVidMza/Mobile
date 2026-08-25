module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
  },
  moduleNameMapper: {
    '^react-native$': 'react-native-web',
    '^react-native-safe-area-context$': '<rootDir>/__mocks__/react-native-safe-area-context.js',
    '^react-native-vector-icons/(.*)$': '<rootDir>/__mocks__/react-native-vector-icons/MaterialCommunityIcons.js',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  collectCoverageFrom: [
    'src/config/**/*.{ts,tsx}',
    'src/db/**/*.{ts,tsx}',
    'src/services/**/*.{ts,tsx}',
    'src/stores/**/*.{ts,tsx}',
    'src/sync/**/*.{ts,tsx}',
    'src/utils/**/*.{ts,tsx}',
    'src/components/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
  ],
};
