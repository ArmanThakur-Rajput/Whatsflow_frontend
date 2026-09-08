import { create } from 'zustand';
import axiosInstance from '../api/axiosInstance';

export interface Property {
  _id: string;
  projectName: string;
  intent: 'rent' | 'buy';
  propertyType: string;
  flatConfig?: string;
  carpetArea?: string;
  buildupArea?: string;
  plotArea?: string;
  location: string;
  address?: string;
  price?: string;
  amenities?: string[];
  parking?: string;
  notes?: string;
  ownerName?: string;
  ownerPhone?: string;
  photos: string[];
  status: 'available' | 'sold' | 'rented';
  soldOrRentedAt?: string;
  createdAt: string;
}

export interface MasterDataItem {
  _id: string;
  category: 'location' | 'amenity' | 'parking' | 'propertyType';
  value: string;
}

export interface PropertyStats {
  total: number;
  available: number;
  sold: number;
}

export interface LocationSummary {
  _id: string;
  total: number;
  available: number;
  sold: number;
  rented: number;
}

export interface TypeSummary {
  _id: string;
  total: number;
  available: number;
  sold: number;
  rented: number;
}

interface PropertyStore {
  stats: PropertyStats;
  masterData: MasterDataItem[];
  locations: LocationSummary[];
  types: TypeSummary[];
  properties: Property[];
  isLoading: boolean;

  fetchStats: () => Promise<void>;
  fetchMasterData: (category?: string) => Promise<void>;
  addMasterData: (category: string, value: string) => Promise<void>;
  deleteMasterData: (id: string) => Promise<void>;
  fetchLocationsSummary: () => Promise<void>;
  fetchTypesSummary: (location?: string) => Promise<void>;
  fetchProperties: (filters?: { location?: string; propertyType?: string; status?: string; flatConfig?: string }) => Promise<void>;
  createProperty: (data: Partial<Property>) => Promise<Property>;
  updateProperty: (id: string, data: Partial<Property>) => Promise<Property>;
  deleteProperty: (id: string) => Promise<void>;
  setPropertyStatus: (id: string, status: 'available' | 'sold' | 'rented') => Promise<void>;
  uploadPhotos: (id: string, photos: string[]) => Promise<string[]>;
  deletePhoto: (id: string, url: string) => Promise<string[]>;
  getPropertyById: (id: string) => Promise<Property>;
}

export const usePropertyStore = create<PropertyStore>((set, get) => ({
  stats: { total: 0, available: 0, sold: 0 },
  masterData: [],
  locations: [],
  types: [],
  properties: [],
  isLoading: false,

  fetchStats: async () => {
    try {
      const { data } = await axiosInstance.get('/property-crm/stats');
      set({ stats: data });
    } catch {}
  },

  fetchMasterData: async (category?: string) => {
    try {
      const params = category ? { category } : {};
      const { data } = await axiosInstance.get('/property-crm/master-data', { params });
      set({ masterData: data.items });
    } catch {}
  },

  addMasterData: async (category: string, value: string) => {
    const { data } = await axiosInstance.post('/property-crm/master-data', { category, value });
    set((s) => ({ masterData: [...s.masterData, data.item] }));
  },

  deleteMasterData: async (id: string) => {
    await axiosInstance.delete(`/property-crm/master-data/${id}`);
    set((s) => ({ masterData: s.masterData.filter((m) => m._id !== id) }));
  },

  fetchLocationsSummary: async () => {
    try {
      const { data } = await axiosInstance.get('/property-crm/locations-summary');
      set({ locations: data.locations });
    } catch {}
  },

  fetchTypesSummary: async (location?: string) => {
    try {
      const params = location ? { location } : {};
      const { data } = await axiosInstance.get('/property-crm/types-summary', { params });
      set({ types: data.types });
    } catch {}
  },

  fetchProperties: async (filters = {}) => {
    set({ isLoading: true });
    try {
      const { data } = await axiosInstance.get('/property-crm/properties', { params: filters });
      set({ properties: data.properties });
    } finally {
      set({ isLoading: false });
    }
  },

  createProperty: async (propData) => {
    const { data } = await axiosInstance.post('/property-crm/properties', propData);
    return data.property;
  },

  updateProperty: async (id, propData) => {
    const { data } = await axiosInstance.patch(`/property-crm/properties/${id}`, propData);
    return data.property;
  },

  deleteProperty: async (id: string) => {
    await axiosInstance.delete(`/property-crm/properties/${id}`);
    set((s) => ({
      properties: s.properties.filter((p) => p._id !== id),
    }));
  },

  setPropertyStatus: async (id, status) => {
    await axiosInstance.patch(`/property-crm/properties/${id}/status`, { status });
    set((s) => ({
      properties: s.properties.map((p) =>
        p._id === id ? { ...p, status } : p
      ),
    }));
  },

  uploadPhotos: async (id, photos) => {
    const { data } = await axiosInstance.post(`/property-crm/properties/${id}/photos`, { photos });
    return data.photos;
  },

  deletePhoto: async (id, url) => {
    const { data } = await axiosInstance.delete(`/property-crm/properties/${id}/photos`, { data: { url } });
    return data.photos;
  },

  getPropertyById: async (id) => {
    const { data } = await axiosInstance.get(`/property-crm/properties/${id}`);
    return data.property;
  },
}));
