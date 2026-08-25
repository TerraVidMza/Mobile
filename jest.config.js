module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^react-native$': 'react-native-web',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/config/**/*.{ts,tsx}',
    'src/db/**/*.{ts,tsx}',
    'src/services/**/*.{ts,tsx}',
    'src/stores/**/*.{ts,tsx}',
    'src/sync/**/*.{ts,tsx}',
    'src/utils/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
  ],
};
