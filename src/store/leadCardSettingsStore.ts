import { create } from 'zustand';
import axiosInstance from '../api/axiosInstance';

// Default fields jo hamesha available hain (custom fields alag se add honge)
export const DEFAULT_FIELD_KEYS = [
  'phone',
  'email',
  'city',
  'source',
  'car',
  'campaign',
  'secondaryPhone',
] as const;

export interface LeadCardField {
  key: string;       // e.g. 'phone', 'email', or custom field key like 'budget'
  label: string;     // Display label e.g. 'Phone', 'Email', 'Budget'
  enabled: boolean;  // Toggle on/off
  order: number;     // Position in card (0 = top)
  isCustom: boolean; // Custom field ya default field
}

interface LeadCardSettingsStore {
  fields: LeadCardField[];
  isLoading: boolean;
  isSaving: boolean;
  hasFetched: boolean;

  // Fetch user ki current settings from DB
  fetchSettings: () => Promise<void>;

  // Save settings to DB
  saveSettings: (fields: LeadCardField[]) => Promise<void>;

  // Local state update (before save)
  setFields: (fields: LeadCardField[]) => void;

  // Toggle single field
  toggleField: (key: string) => void;

  // Move field up in order
  moveFieldUp: (key: string) => void;

  // Move field down in order
  moveFieldDown: (key: string) => void;
}

export const useLeadCardSettingsStore = create<LeadCardSettingsStore>((set, get) => ({
  fields: [],
  isLoading: false,
  isSaving: false,
  hasFetched: false,

  fetchSettings: async () => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.get('/users/lead-card-settings');
      set({
        fields: res.data.fields || [],
        isLoading: false,
        hasFetched: true,
      });
    } catch (err: any) {
      console.error('fetchLeadCardSettings error:', err.response?.data?.message || err.message);
      set({ isLoading: false, hasFetched: true });
    }
  },

  saveSettings: async (fields: LeadCardField[]) => {
    set({ isSaving: true });
    try {
      await axiosInstance.put('/users/lead-card-settings', { fields });
      set({ fields, isSaving: false });
    } catch (err: any) {
      console.error('saveLeadCardSettings error:', err.response?.data?.message || err.message);
      set({ isSaving: false });
      throw err;
    }
  },

  setFields: (fields) => set({ fields }),

  toggleField: (key) => {
    const fields = get().fields.map((f) =>
      f.key === key ? { ...f, enabled: !f.enabled } : f
    );
    set({ fields });
  },

  moveFieldUp: (key) => {
    const fields = [...get().fields].sort((a, b) => a.order - b.order);
    const idx = fields.findIndex((f) => f.key === key);
    if (idx <= 0) return;
    // Swap with previous
    const updated = [...fields];
    const temp = updated[idx].order;
    updated[idx] = { ...updated[idx], order: updated[idx - 1].order };
    updated[idx - 1] = { ...updated[idx - 1], order: temp };
    set({ fields: updated });
  },

  moveFieldDown: (key) => {
    const fields = [...get().fields].sort((a, b) => a.order - b.order);
    const idx = fields.findIndex((f) => f.key === key);
    if (idx < 0 || idx >= fields.length - 1) return;
    // Swap with next
    const updated = [...fields];
    const temp = updated[idx].order;
    updated[idx] = { ...updated[idx], order: updated[idx + 1].order };
    updated[idx + 1] = { ...updated[idx + 1], order: temp };
    set({ fields: updated });
  },
}));
