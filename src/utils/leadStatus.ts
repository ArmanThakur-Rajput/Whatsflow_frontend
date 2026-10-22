import { colors } from '../theme/colors';

export const CURRENT_STATUS_COLORS: Record<string, string> = {
  New: colors.statusNew,
  Interested: colors.statusInterested,
  Contacted: colors.statusContacted,
  'Not Interested': colors.statusNotInterested,
  Pending: '#D97706',
};

export const getDisplayStatus = (status?: string) => status || 'New';

export const getStatusColor = (status?: string) =>
  CURRENT_STATUS_COLORS[status || 'New'] || colors.primary;
