import {Platform, useColorScheme} from 'react-native';
import {MD3DarkTheme, MD3LightTheme} from 'react-native-paper';

const navigationFonts = Platform.select({
  ios: {
    regular: {fontFamily: 'System', fontWeight: '400'},
    medium: {fontFamily: 'System', fontWeight: '500'},
    bold: {fontFamily: 'System', fontWeight: '600'},
    heavy: {fontFamily: 'System', fontWeight: '700'},
  },
  default: {
    regular: {fontFamily: 'sans-serif', fontWeight: 'normal'},
    medium: {fontFamily: 'sans-serif-medium', fontWeight: 'normal'},
    bold: {fontFamily: 'sans-serif', fontWeight: '600'},
    heavy: {fontFamily: 'sans-serif', fontWeight: '700'},
  },
});

const spacing = Object.freeze({xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32});
const type = Object.freeze({caption: 12, body: 14, label: 15, title: 22, hero: 28});

const light = Object.freeze({
  background: '#FAFBFD',
  surface: '#FFFFFF',
  surfaceMuted: '#F0F5FB',
  text: '#0B1D3B',
  textMuted: '#506583',
  accent: '#2878C2',
  accentText: '#FFFFFF',
  border: '#CCD9E8',
  success: '#126B4A',
  warning: '#825400',
  danger: '#A52A25',
  technical: '#152B4D',
});

const dark = Object.freeze({
  background: '#0D1726',
  surface: '#17243A',
  surfaceMuted: '#21334C',
  text: '#F1F6FC',
  textMuted: '#B6C7DC',
  accent: '#86C5FF',
  accentText: '#09233D',
  border: '#425873',
  success: '#7DDBB2',
  warning: '#F4CE7A',
  danger: '#FF9B96',
  technical: '#E4F1FF',
});

function visualColors(isDark) {
  return isDark ? dark : light;
}

function createPaperTheme(isDark) {
  const base = isDark ? MD3DarkTheme : MD3LightTheme;
  const colors = visualColors(isDark);
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      onPrimary: colors.accentText,
      background: colors.background,
      surface: colors.surface,
      onSurface: colors.text,
      onSurfaceVariant: colors.textMuted,
      outline: colors.border,
      error: colors.danger,
    },
  };
}

function createNavigationTheme(isDark) {
  const colors = visualColors(isDark);
  return {
    dark: isDark,
    fonts: navigationFonts,
    colors: {
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
  };
}

function useVisualTheme() {
  const isDark = useColorScheme() === 'dark';
  return {isDark, colors: visualColors(isDark), spacing, type};
}

export {spacing, type, light, dark, visualColors, createPaperTheme, createNavigationTheme, useVisualTheme};
