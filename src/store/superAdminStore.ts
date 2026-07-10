import { create } from 'zustand';
import axiosInstance from '../api/axiosInstance';

export interface Organization {
  _id: string;
  name: string;
  businessType?: string;
  isActive: boolean;
  adminCount: number;
  activeAdminCount: number;
  totalLeads: number;
  createdAt: string;
}

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  isActive: boolean;
  tenantId: string | { _id: string; name: string; businessType?: string; isActive: boolean };
  createdAt: string;
}

interface SuperAdminStore {
  organizations: Organization[];
  admins: AdminUser[];
  isLoading: boolean;

  fetchOrganizations: () => Promise<void>;
  fetchAllAdmins: () => Promise<void>;
  fetchAdminsByOrg: (orgId: string) => Promise<AdminUser[]>;

  addAdmin: (data: {
    orgName: string;
    businessType?: string;
    name: string;
    email: string;
    phone?: string;
    password?: string;
  }) => Promise<void>;

  addAdminToOrg: (orgId: string, data: {
    name: string; email: string; phone?: string; password?: string;
  }) => Promise<void>;

  updateAdmin: (id: string, data: { name?: string; email?: string; phone?: string }) => Promise<void>;
  toggleAdminStatus: (id: string) => Promise<void>;
  deleteAdmin: (id: string) => Promise<void>;
  toggleOrgStatus: (orgId: string) => Promise<void>;
}

export const useSuperAdminStore = create<SuperAdminStore>((set, get) => ({
  organizations: [],
  admins: [],
  isLoading: false,

  fetchOrganizations: async () => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.get('/super-admin/organizations');
      set({ organizations: res.data.organizations, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  fetchAllAdmins: async () => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.get('/super-admin/admins');
      set({ admins: res.data.admins, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  fetchAdminsByOrg: async (orgId: string) => {
    const res = await axiosInstance.get(`/super-admin/organizations/${orgId}/admins`);
    return res.data.admins;
  },

  addAdmin: async (data) => {
    await axiosInstance.post('/super-admin/admins', data);
    await get().fetchOrganizations();
  },

  addAdminToOrg: async (orgId, data) => {
    await axiosInstance.post(`/super-admin/organizations/${orgId}/admins`, data);
    await get().fetchOrganizations();
  },

  updateAdmin: async (id, data) => {
    await axiosInstance.patch(`/super-admin/admins/${id}`, data);
    await get().fetchAllAdmins();
  },

  toggleAdminStatus: async (id) => {
    await axiosInstance.patch(`/super-admin/admins/${id}/toggle`);
    await get().fetchAllAdmins();
  },

  deleteAdmin: async (id) => {
    await axiosInstance.delete(`/super-admin/admins/${id}`);
    await get().fetchAllAdmins();
    await get().fetchOrganizations();
  },

  toggleOrgStatus: async (orgId) => {
    await axiosInstance.patch(`/super-admin/organizations/${orgId}/toggle`);
    await get().fetchOrganizations();
  },
}));
