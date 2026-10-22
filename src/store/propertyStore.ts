import { create } from 'zustand';
import axiosInstance from '../api/axiosInstance';

export interface Property {
  _id: string;
  projectName: string;
  propertyType: string;
  location: string;
  price: string;
  floor: string;
  carpetArea?: string;
  buildupArea?: string;
  sanction: 'Yes' | 'No';
  parking: 'Open' | 'Covered' | 'None';
  water: 'Municipal Corporation' | 'Gram Panchayat' | 'Tanker' | 'Boring';
  // optional
  intent?: 'rent' | 'buy';
  flatConfig?: string;
  buildingArea?: string;
  flatsOnFloor?: string;
  lift?: 'Yes' | 'No' | '';
  wings?: string;
  facing?: string;
  amenities?: string[];
  plotArea?: string;
  address?: string;
  notes?: string;
  ownerName?: string;
  ownerPhone?: string;
  tenantPhone?: string;
  gmapsLink?: string;
  photos?: string[];
  status: 'available' | 'sold' | 'rented';
  createdAt?: string;
}

interface PropertyStats {
  total: number;
  available: number;
  sold: number;
}

interface PropertyStore {
  properties: Property[];
  stats: PropertyStats;
  isLoading: boolean;
  error: string | null;

  fetchProperties: (filters?: Record<string, string>) => Promise<void>;
  fetchStats: () => Promise<void>;
  createProperty: (data: Partial<Property>) => Promise<void>;
  updateProperty: (id: string, data: Partial<Property>) => Promise<void>;
  deleteProperty: (id: string) => Promise<void>;
  setPropertyStatus: (id: string, status: 'available' | 'sold' | 'rented') => Promise<void>;
  uploadPhotos: (id: string, files: any[]) => Promise<void>;
  deletePhoto: (id: string, url: string) => Promise<void>;
  exportCSV: (filters?: Record<string, string>) => Promise<string>;
}

export const usePropertyStore = create<PropertyStore>((set, get) => ({
  properties: [],
  stats: { total: 0, available: 0, sold: 0 },
  isLoading: false,
  error: null,

  fetchProperties: async (filters = {}) => {
    set({ isLoading: true });
    try {
      const params = new URLSearchParams(filters as any);
      const res = await axiosInstance.get(`/property-crm/properties?${params.toString()}`);
      set({ properties: res.data.properties || [], isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  fetchStats: async () => {
    try {
      const res = await axiosInstance.get('/property-crm/stats');
      set({ stats: res.data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  createProperty: async (data) => {
    try {
      await axiosInstance.post('/property-crm/properties', data);
      await get().fetchProperties();
      await get().fetchStats();
    } catch (err: any) {
      throw err;
    }
  },

  updateProperty: async (id, data) => {
    try {
      await axiosInstance.patch(`/property-crm/properties/${id}`, data);
      await get().fetchProperties();
    } catch (err: any) {
      throw err;
    }
  },

  deleteProperty: async (id) => {
    try {
      await axiosInstance.delete(`/property-crm/properties/${id}`);
      await get().fetchProperties();
      await get().fetchStats();
    } catch (err: any) {
      throw err;
    }
  },

  setPropertyStatus: async (id, status) => {
    try {
      await axiosInstance.patch(`/property-crm/properties/${id}/status`, { status });
      await get().fetchProperties();
      await get().fetchStats();
    } catch (err: any) {
      throw err;
    }
  },

  uploadPhotos: async (id, files) => {
    try {
      const form = new FormData();
      files.forEach((f) => form.append('photos', f));
      await axiosInstance.post(`/property-crm/properties/${id}/photos`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await get().fetchProperties();
    } catch (err: any) {
      throw err;
    }
  },

  deletePhoto: async (id, url) => {
    try {
      await axiosInstance.delete(`/property-crm/properties/${id}/photos`, { data: { url } });
      await get().fetchProperties();
    } catch (err: any) {
      throw err;
    }
  },

  exportCSV: async (filters = {}) => {
    const params = new URLSearchParams(filters as any);
    const res = await axiosInstance.get(`/property-crm/properties/export-csv?${params.toString()}`, {
      responseType: 'text',
    });
    return res.data as string;
  },
}));
