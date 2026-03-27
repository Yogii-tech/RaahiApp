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

const darkColors: ThemeColors = {
  primary: '#1E90FF',
  secondary: '#00BFFF',
  background: '#181F2A',
  cardColor: '#162032',
  borderColor: 'rgba(30,144,255,0.2)',
  textColor: '#FFFFFF',
  subtextColor: 'rgba(255,255,255,0.7)',
  accentColor: '#00FFFF',
  inputFillColor: '#181F2A',
  inputBorderColor: 'rgba(30,144,255,0.12)',
};

const lightColors: ThemeColors = {
  primary: '#5B4FFF',
  secondary: '#00BFFF',
  background: '#F8F9FF',
  cardColor: '#FFFFFF',
  borderColor: 'rgba(91,79,255,0.12)',
  textColor: '#222260',
  subtextColor: 'rgba(34,34,96,0.7)',
  accentColor: '#00BFFF',
  inputFillColor: '#F8F9FF',
  inputBorderColor: 'rgba(91,79,255,0.10)',
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
