import React, { createContext, useContext, useState, useMemo } from 'react';

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  cardColor: string;
  borderColor: string;
  textColor: string;
  subtextColor: string;
  accentColor: string;
  inputFillColor: string;
  inputBorderColor: string;
}

export const darkColors: ThemeColors = {
  primary: '#1E90FF',
  secondary: '#00BFFF',
  background: '#181F2A',
  cardColor: 'rgba(22, 32, 50, 0.58)',
  borderColor: 'rgba(255, 255, 255, 0.16)',
  textColor: '#FFFFFF',
  subtextColor: 'rgba(255,255,255,0.7)',
  accentColor: '#00FFFF',
  inputFillColor: 'rgba(15, 23, 42, 0.55)',
  inputBorderColor: 'rgba(255, 255, 255, 0.16)',
};

export const lightColors: ThemeColors = {
  primary: '#5B4FFF',
  secondary: '#00BFFF',
  background: '#F4F7FF',
  cardColor: 'rgba(255, 255, 255, 0.56)',
  borderColor: 'rgba(255, 255, 255, 0.85)',
  textColor: '#222260',
  subtextColor: 'rgba(34,34,96,0.72)',
  accentColor: '#00BFFF',
  inputFillColor: 'rgba(255, 255, 255, 0.62)',
  inputBorderColor: 'rgba(255, 255, 255, 0.85)',
};

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  toggleTheme: () => { },
  colors: lightColors,
});


export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(false);


  const toggleTheme = () => setIsDark(prev => !prev);

  const colors = useMemo(() => (isDark ? darkColors : lightColors), [isDark]);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
