const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

const appDirectory = __dirname;

// Babel loader configuration for react-native-web
const babelLoaderConfiguration = {
    test: /\.(ts|tsx|js|jsx)$/,
    include: [
        path.resolve(appDirectory, 'index.web.js'),
        path.resolve(appDirectory, 'App.tsx'),
        path.resolve(appDirectory, 'src'),
        // Include react-native and related packages that need to be transpiled
        path.resolve(appDirectory, 'node_modules/react-native'),
        path.resolve(appDirectory, 'node_modules/@react-native'),
        path.resolve(appDirectory, 'node_modules/@react-navigation'),
        path.resolve(appDirectory, 'node_modules/react-native-screens'),
        path.resolve(appDirectory, 'node_modules/react-native-safe-area-context'),
    ],
    use: {
        loader: 'babel-loader',
        options: {
            configFile: false,
            babelrc: false,
            presets: [
                ['@react-native/babel-preset', { disableImportExportTransform: true }],
                ['@babel/preset-env', { modules: false, loose: true }],
                ['@babel/preset-react', { runtime: 'automatic' }]
            ],
            plugins: ['react-native-web'],
        },
    },
};

// Asset loader configuration for images and fonts
const imageLoaderConfiguration = {
    test: /\.(gif|jpe?g|png|svg|ttf)$/,
    type: 'asset/resource',
};

module.exports = {
    entry: [
        'regenerator-runtime/runtime',
        path.resolve(appDirectory, 'index.web.js')
    ],
    output: {
        path: path.resolve(appDirectory, 'dist'),
        filename: 'bundle.js',
        publicPath: '/',
    },
    module: {
        rules: [
            {
                test: /\.m?js/,
                resolve: {
                    fullySpecified: false,
                },
            },
            babelLoaderConfiguration,
            imageLoaderConfiguration,
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    {
                        loader: 'css-loader',
                        options: {
                            esModule: false,
                            modules: {
                                auto: true, // automatically enable CSS modules for .module.css
                                localIdentName: '[name]__[local]--[hash:base64:5]',
                            },
                        },
                    },
                ],
            },
        ],
    },
    resolve: {
        alias: {
            'react-native$': 'react-native-web',
            'expo-updates': false,
            'expo-router/build/global-state/router-store': false,
        },
        extensions: [
            '.web.tsx',
            '.web.ts',
            '.tsx',
            '.ts',
            '.web.js',
            '.js',
            '.web.jsx',
            '.jsx',
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: path.resolve(appDirectory, 'public/index.html'),
        }),
        // Copy static files from public/ to dist/ for production builds.
        // firebase-messaging-sw.js MUST be at the root for push notifications to work.
        // logo192.png is the notification icon referenced by the service worker.
        new CopyWebpackPlugin({
            patterns: [
                { from: path.resolve(appDirectory, 'public/firebase-messaging-sw.js'), to: '.' },
                { from: path.resolve(appDirectory, 'public/logo192.png'), to: '.', noErrorOnMissing: true },
                { from: path.resolve(appDirectory, 'public/manifest.json'), to: '.' },
            ],
        }),
        // Inject __DEV__ so React Native code works on web.
        // Metro bundler defines this automatically; webpack does not.
        new webpack.DefinePlugin({
            __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
            'process.env.SENTRY_DSN': JSON.stringify(process.env.SENTRY_DSN || ''),
        }),
    ],
    devServer: {
        static: path.resolve(appDirectory, 'public'),
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: 'all',
        hot: true,
        historyApiFallback: true,
        server: 'http',
        proxy: [
            {
                context: ['/api', '/uploads'],
                target: 'http://127.0.0.1:8080',
                secure: false,
                changeOrigin: true
            }
        ],
        client: {
            overlay: {
                errors: true,
                warnings: false,
            },
        },
    },
    cache: false,
    devtool: process.env.NODE_ENV === 'production' ? 'nosources-source-map' : 'source-map',
    watchOptions: {
        ignored: ['**/node_modules', '**/android', '**/ios', '**/dist'],
    },
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
};
