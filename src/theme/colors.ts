// ─────────────────────────────────────────────────────────────────────────────
// Reactive colors — every screen that does `import { colors } from './colors'`
// automatically gets the current theme because `colors` is a mutable object
// whose keys are updated in-place whenever the theme changes.
//
// HOW IT WORKS:
//   1. `colors` is a plain mutable JS object (not a const with frozen values).
//   2. ThemeProvider (in App.tsx) calls applyTheme() on every theme change,
//      which overwrites every key of `colors` in-place.
//   3. Because React re-renders the whole tree when theme changes (via
//      useThemeStore subscription in ThemeProvider), every component that
//      reads `colors` at render time picks up the new values — even though
//      they imported it statically.
//
// No migration needed. All existing screens work as-is.
// ─────────────────────────────────────────────────────────────────────────────

import { ThemePreset } from '../store/themeStore';

// The single shared mutable colors object — every import of `colors`
// points to this exact object reference. Keys are reassigned in-place.
export const colors: ThemePreset & {
  error: string; success: string; warning: string;
  statusNew: string; statusInterested: string; statusContacted: string;
  statusNotInterested: string; statusBooked: string; pending: string;
} = {
  // Default = Sky Blue (matches themeStore default)
  id: 'sky',
  name: 'Sky Blue',
  primary: '#0EA5E9',
  primaryDark: '#0284C7',
  primaryLight: '#E0F2FE',
  background: '#F5F7FA',
  card: '#FFFFFF',
  white: '#FFFFFF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  textPrimary: '#1A1A2E',
  textSecondary: '#6B7280',
  textLight: '#9CA3AF',
  shadow: '#000000',
  // Semantic — fixed across all themes
  error: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  statusNew: '#6B7280',
  statusInterested: '#EF4444',
  statusContacted: '#F59E0B',
  statusNotInterested: '#3B82F6',
  statusBooked: '#059669',
  pending: '#D97706',
};

// Called by ThemeProvider whenever theme changes.
// Mutates the shared `colors` object in-place so all existing imports
// automatically reflect the new theme on the next render.
export function applyTheme(theme: ThemePreset) {
  colors.id = theme.id;
  colors.name = theme.name;
  colors.primary = theme.primary;
  colors.primaryDark = theme.primaryDark;
  colors.primaryLight = theme.primaryLight;
  colors.background = theme.background;
  colors.card = theme.card;
  colors.white = theme.white;
  colors.border = theme.border;
  colors.borderLight = theme.borderLight;
  colors.textPrimary = theme.textPrimary;
  colors.textSecondary = theme.textSecondary;
  colors.textLight = theme.textLight;
  colors.shadow = theme.shadow;
  // Semantic colors stay fixed — do not overwrite them
}
