import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { Lead } from '../../types/lead.types';
import { LeadCardField } from '../../store/leadCardSettingsStore';

const STATUS_COLORS: Record<string, string> = {
  New: '#6B7280',
  Interested: '#EF4444',
  Contacted: '#F59E0B',
  'Not Interested': '#3B82F6',
  Pending: '#D97706',
  Booked: '#059669',
};

// Icons for each default field
const FIELD_ICONS: Record<string, string> = {
  phone:          'call-outline',
  secondaryPhone: 'call-outline',
  email:          'mail-outline',
  city:           'location-outline',
  source:         'globe-outline',
  car:            'car-outline',
  campaign:       'megaphone-outline',
};

// Field value getter from a Lead object
function getFieldValue(lead: Lead, key: string): string | null {
  switch (key) {
    case 'phone':          return lead.phone || null;
    case 'secondaryPhone': return lead.secondaryPhone || null;
    case 'email':          return lead.email || null;
    case 'city':           return lead.city || null;
    case 'source':         return lead.source || null;
    case 'car':            return lead.car ? `🚗 ${lead.car}` : null;
    case 'campaign':       return lead.campaign || null;
    default:
      // Custom field
      if (lead.customFields && typeof lead.customFields === 'object') {
        const val = (lead.customFields as Record<string, any>)[key];
        return val != null && val !== '' ? String(val) : null;
      }
      return null;
  }
}

export interface DynamicLeadCardProps {
  lead: Lead;
  onPress: () => void;
  /** Pass the user's sorted + enabled fields from leadCardSettingsStore */
  cardFields: LeadCardField[];
  onTogglePin?: () => void;
  /** Show date below source */
  dateLabel?: string;
  /** Extra action buttons (e.g. "Not Interested" for employee screen) */
  extraActions?: React.ReactNode;
  /** Show assigned to chip (admin view) */
  assignedToName?: string;
  /** Search query for highlighting — future use */
  searchQuery?: string;
}

export const DynamicLeadCard = React.memo(({
  lead,
  onPress,
  cardFields,
  onTogglePin,
  dateLabel,
  extraActions,
  assignedToName,
}: DynamicLeadCardProps) => {
  const statusColor = STATUS_COLORS[lead.status] || colors.primary;
  const showPinned = !!onTogglePin && lead.isPinned;

  // Only enabled fields in their order
  const enabledFields = cardFields.filter((f) => f.enabled);

  return (
    <TouchableOpacity
      style={[styles.leadCard, showPinned && styles.pinnedCard]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Pinned badge */}
      {showPinned && (
        <TouchableOpacity
          style={styles.pinnedIndicator}
          onPress={onTogglePin}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="bookmark" size={12} color={colors.white} />
          <Text style={styles.pinnedText}>Pinned</Text>
        </TouchableOpacity>
      )}

      {/* Left color bar */}
      <View style={[styles.colorBar, { backgroundColor: statusColor }]} />

      <View style={styles.cardContent}>
        {/* Top row — avatar + name + status badge (always fixed) */}
        <View style={styles.cardTop}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {lead.name.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.leadInfo}>
            <Text style={styles.leadName} numberOfLines={1}>
              {lead.name}
            </Text>

            {/* Dynamic fields rendered below name */}
            {enabledFields.map((field) => {
              const value = getFieldValue(lead, field.key);
              if (!value) return null;

              const iconName = FIELD_ICONS[field.key] || 'apps-outline';
              const isCustom = field.isCustom;

              return (
                <View key={field.key} style={styles.fieldRow}>
                  <Text style={styles.fieldIcon}>•</Text>
                  <Text
                    style={[styles.fieldValue, isCustom && styles.customFieldValue]}
                    numberOfLines={1}
                  >
                    {isCustom ? `${field.label}: ${value}` : value}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Status badge */}
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {lead.status}
            </Text>
          </View>
        </View>

        {/* Bottom row */}
        <View style={styles.cardBottom}>
          <View style={styles.bottomLeft}>
            {assignedToName ? (
              <View style={styles.chip}>
                <Ionicons name="person-outline" size={12} color={colors.textSecondary} />
                <Text style={styles.chipText} numberOfLines={1}>
                  {assignedToName}
                </Text>
              </View>
            ) : dateLabel ? (
              <View style={styles.chip}>
                <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
                <Text style={styles.chipText}>{dateLabel}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.actionButtons}>
            {extraActions}
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => Linking.openURL(`tel:${lead.phone}`)}
            >
              <Ionicons name="call" size={16} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.whatsappBtn]}
              onPress={() => {
                const phone = lead.phone.replace(/\D/g, '');
                Linking.openURL(`https://wa.me/91${phone}`);
              }}
            >
              <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  leadCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    flexDirection: 'row',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  pinnedCard: { borderWidth: 1.5, borderColor: colors.primary, elevation: 4 },
  pinnedIndicator: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderBottomLeftRadius: 8, flexDirection: 'row',
    alignItems: 'center', gap: 4, zIndex: 1,
  },
  pinnedText: { fontSize: 10, color: colors.white, fontWeight: typography.bold },
  colorBar: { width: 4 },
  cardContent: { flex: 1, padding: spacing.md, gap: spacing.xs },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  avatarCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.primary,
  },
  leadInfo: { flex: 1, gap: 2 },
  leadName: {
    fontSize: typography.base,
    fontWeight: typography.semiBold,
    color: colors.textPrimary,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  fieldIcon: { flexShrink: 0 },
  fieldValue: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  customFieldValue: { color: colors.textPrimary },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 8,
    flexShrink: 0,
  },
  statusText: { fontSize: typography.xs, fontWeight: typography.semiBold },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  bottomLeft: { flex: 1 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipText: { fontSize: typography.xs, color: colors.textSecondary, flexShrink: 1 },
  actionButtons: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: {
    backgroundColor: colors.primaryLight,
    padding: spacing.sm,
    borderRadius: 8,
  },
  whatsappBtn: { backgroundColor: '#E8FFF1' },
});
