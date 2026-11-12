module.exports = {
  preset: 'react-native',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native-async-storage|@react-native-firebase|@react-navigation|@sentry/react-native|react-native-vector-icons|react-native-safe-area-context|react-native-screens|react-native-maps|firebase|@firebase)/)',
  ],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/__tests__/mocks/styleMock.js',
  },
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/__tests__/mocks/'],
};
