import {createNavigationTheme, createPaperTheme, dark, light} from '../src/visual/theme';
import {actionNotice} from '../src/features/toolkit/actionNotice';

function luminance(hex) {
  const channels = hex.match(/[a-f0-9]{2}/gi).map((value) => parseInt(value, 16) / 255);
  const [red, green, blue] = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test.each([[false, light], [true, dark]])('semantic colors keep text legible in %s appearance', (isDark, colors) => {
  expect(contrast(colors.text, colors.background)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.textMuted, colors.surface)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.accentText, colors.accent)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.danger, colors.background)).toBeGreaterThanOrEqual(4.5);

  const paper = createPaperTheme(isDark);
  const navigation = createNavigationTheme(isDark);
  expect(paper.colors.primary).toBe(colors.accent);
  expect(paper.colors.background).toBe(colors.background);
  expect(navigation.colors.primary).toBe(colors.accent);
  expect(navigation.colors.background).toBe(colors.background);
  expect(navigation.dark).toBe(isDark);
});

test('toolkit notices describe actual high-impact actions, not editor navigation', () => {
  expect(actionNotice('Erase')).toBe('ERASES DATA');
  expect(actionNotice('NDEF Format')).toBe('ERASES DATA');
  expect(actionNotice('Make Read Only')).toBe('PERMANENT CHANGE');
  expect(actionNotice('[NTAG213] Enable password')).toBe('CHANGES TAG');
  expect(actionNotice('Flow Script')).toBeNull();
  expect(actionNotice('Custom Transceive')).toBeNull();
  expect(actionNotice('Type 2 Memory Scan')).toBeNull();
});
