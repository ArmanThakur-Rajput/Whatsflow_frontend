import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────────────────────────────────────
// Preset themes — each defines the primary color family + backgrounds.
// Status colors are intentionally shared across all themes since they
// carry semantic meaning (green = booked, red = interested, etc.) and
// changing them with theme would confuse users.
// ─────────────────────────────────────────────────────────────────────────────
export interface ThemePreset {
  id: string;
  name: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  background: string;
  card: string;
  white: string;
  border: string;
  borderLight: string;
  textPrimary: string;
  textSecondary: string;
  textLight: string;
  shadow: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
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
  },
  {
    id: 'violet',
    name: 'Violet',
    primary: '#7C3AED',
    primaryDark: '#6D28D9',
    primaryLight: '#EDE9FE',
    background: '#F5F3FF',
    card: '#FFFFFF',
    white: '#FFFFFF',
    border: '#DDD6FE',
    borderLight: '#F5F3FF',
    textPrimary: '#1E1B4B',
    textSecondary: '#6B7280',
    textLight: '#9CA3AF',
    shadow: '#000000',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    primary: '#059669',
    primaryDark: '#047857',
    primaryLight: '#D1FAE5',
    background: '#F0FDF4',
    card: '#FFFFFF',
    white: '#FFFFFF',
    border: '#A7F3D0',
    borderLight: '#ECFDF5',
    textPrimary: '#064E3B',
    textSecondary: '#6B7280',
    textLight: '#9CA3AF',
    shadow: '#000000',
  },
  {
    id: 'rose',
    name: 'Rose',
    primary: '#E11D48',
    primaryDark: '#BE123C',
    primaryLight: '#FFE4E6',
    background: '#FFF1F2',
    card: '#FFFFFF',
    white: '#FFFFFF',
    border: '#FECDD3',
    borderLight: '#FFF1F2',
    textPrimary: '#1A1A2E',
    textSecondary: '#6B7280',
    textLight: '#9CA3AF',
    shadow: '#000000',
  },
  {
    id: 'amber',
    name: 'Amber',
    primary: '#D97706',
    primaryDark: '#B45309',
    primaryLight: '#FEF3C7',
    background: '#FFFBEB',
    card: '#FFFFFF',
    white: '#FFFFFF',
    border: '#FDE68A',
    borderLight: '#FFFBEB',
    textPrimary: '#1A1A2E',
    textSecondary: '#6B7280',
    textLight: '#9CA3AF',
    shadow: '#000000',
  },
  {
    id: 'slate',
    name: 'Slate',
    primary: '#475569',
    primaryDark: '#334155',
    primaryLight: '#E2E8F0',
    background: '#F8FAFC',
    card: '#FFFFFF',
    white: '#FFFFFF',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    textLight: '#94A3B8',
    shadow: '#000000',
  },
  {
    id: 'dark',
    name: 'Dark',
    primary: '#38BDF8',
    primaryDark: '#0EA5E9',
    primaryLight: '#1E3A5F',
    background: '#0F172A',
    card: '#1E293B',
    white: '#1E293B',
    border: '#334155',
    borderLight: '#1E293B',
    textPrimary: '#F1F5F9',
    textSecondary: '#94A3B8',
    textLight: '#64748B',
    shadow: '#000000',
  },
];

const STORAGE_KEY = 'app_theme_id';
const DEFAULT_THEME_ID = 'sky';

interface ThemeStore {
  activeThemeId: string;
  theme: ThemePreset;
  isLoaded: boolean;
  setTheme: (id: string) => Promise<void>;
  loadTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  activeThemeId: DEFAULT_THEME_ID,
  theme: THEME_PRESETS[0],
  isLoaded: false,

  loadTheme: async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      const found = THEME_PRESETS.find((t) => t.id === saved);
      if (found) {
        set({ activeThemeId: found.id, theme: found, isLoaded: true });
      } else {
        set({ isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },

  setTheme: async (id: string) => {
    const found = THEME_PRESETS.find((t) => t.id === id);
    if (!found) return;
    try {
      await AsyncStorage.setItem(STORAGE_KEY, id);
    } catch {}
    set({ activeThemeId: id, theme: found });
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Semantic colors — fixed across all themes (status chips carry meaning)
// ─────────────────────────────────────────────────────────────────────────────
export const semanticColors = {
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
