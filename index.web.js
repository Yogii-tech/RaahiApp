import { AppRegistry } from 'react-native';
import { createRoot } from 'react-dom/client';
import React from 'react';
import App from './App';

// Register the app
AppRegistry.registerComponent('RaahiApp', () => App);

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = createRoot(rootElement);
    // Get the application component from AppRegistry
    const { element } = AppRegistry.getApplication('RaahiApp');
    root.render(element);
}
