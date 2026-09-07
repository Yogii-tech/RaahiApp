module.exports = {
  presets: [
    '@babel/preset-env',
    '@babel/preset-react',
    '@react-native/babel-preset',
  ],
  plugins: [
    ['@babel/plugin-transform-flow-strip-types', { loose: true }],
  ],
};
