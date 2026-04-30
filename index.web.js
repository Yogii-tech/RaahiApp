import { AppRegistry } from 'react-native';
import { createRoot } from 'react-dom/client';
import React from 'react';
import App from './App';

// Register the app
import Ionicons from 'react-native-vector-icons/Fonts/Ionicons.ttf';

const iconFontStyles = `@font-face {
  src: url(${Ionicons});
  font-family: Ionicons;
}`;

const style = document.createElement('style');
style.type = 'text/css';
if (style.styleSheet) {
    style.styleSheet.cssText = iconFontStyles;
} else {
    style.appendChild(document.createTextNode(iconFontStyles));
}
document.head.appendChild(style);

AppRegistry.registerComponent('RaahiApp', () => App);

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = createRoot(rootElement);
    // Get the application component from AppRegistry
    const { element } = AppRegistry.getApplication('RaahiApp');
    root.render(element);
}
