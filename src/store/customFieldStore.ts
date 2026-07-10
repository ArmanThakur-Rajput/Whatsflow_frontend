import { create } from 'zustand';
import axiosInstance from '../api/axiosInstance';

export type CustomFieldType = 'text' | 'number' | 'select' | 'date';

export interface CustomFieldDefinition {
  _id: string;
  label: string;
  key: string;
  type: CustomFieldType;
  options: string[];
  required: boolean;
  order: number;
  isActive: boolean;
}

interface CustomFieldStore {
  fields: CustomFieldDefinition[];
  isLoading: boolean;
  error: string | null;

  // Fetches only active fields by default — what the lead create/edit
  // form should always use. Pass includeInactive for the admin's field
  // builder screen, which also needs to show/reactivate removed fields.
  fetchFields: (includeInactive?: boolean) => Promise<void>;
  createField: (data: {
    label: string;
    type: CustomFieldType;
    options?: string[];
    required?: boolean;
  }) => Promise<CustomFieldDefinition>;
  updateField: (id: string, data: {
    label?: string;
    options?: string[];
    required?: boolean;
    order?: number;
  }) => Promise<CustomFieldDefinition>;
  deleteField: (id: string) => Promise<void>;
  reactivateField: (id: string) => Promise<void>;
}

export const useCustomFieldStore = create<CustomFieldStore>((set, get) => ({
  fields: [],
  isLoading: false,
  error: null,

  fetchFields: async (includeInactive = false) => {
    set({ isLoading: true, error: null });
    try {
      const res = await axiosInstance.get('/custom-fields', {
        params: includeInactive ? { includeInactive: 'true' } : undefined,
      });
      set({ fields: res.data.fields || [], isLoading: false });
    } catch (err: any) {
      console.error(
        'fetchFields error:',
        err.response?.status,
        err.response?.data?.message || err.message
      );
      set({ isLoading: false, error: err.response?.data?.message || err.message });
    }
  },

  createField: async (data) => {
    const res = await axiosInstance.post('/custom-fields', data);
    const field = res.data.field as CustomFieldDefinition;
    set({ fields: [...get().fields, field] });
    return field;
  },

  updateField: async (id, data) => {
    const res = await axiosInstance.patch(`/custom-fields/${id}`, data);
    const updated = res.data.field as CustomFieldDefinition;
    set({ fields: get().fields.map((f) => (f._id === id ? updated : f)) });
    return updated;
  },

  deleteField: async (id) => {
    await axiosInstance.delete(`/custom-fields/${id}`);
    // Soft-deleted on the backend (isActive: false) — drop it from this
    // store's active list immediately so the UI reflects it right away.
    set({ fields: get().fields.filter((f) => f._id !== id) });
  },

  reactivateField: async (id) => {
    const res = await axiosInstance.patch(`/custom-fields/${id}/reactivate`);
    const updated = res.data.field as CustomFieldDefinition;
    const existing = get().fields;
    const idx = existing.findIndex((f) => f._id === id);
    if (idx >= 0) {
      const next = [...existing];
      next[idx] = updated;
      set({ fields: next });
    } else {
      set({ fields: [...existing, updated] });
    }
  },
}));
