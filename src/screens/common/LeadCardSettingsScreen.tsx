import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Switch, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { useLeadCardSettingsStore, LeadCardField } from '../../store/leadCardSettingsStore';
import { useCustomFieldStore } from '../../store/customFieldStore';

// Default fields ki metadata
const DEFAULT_FIELD_META: Record<string, { label: string; icon: string }> = {
  phone:          { label: 'Phone Number',     icon: 'call-outline' },
  secondaryPhone: { label: 'Secondary Phone',  icon: 'call-outline' },
  email:          { label: 'Email',            icon: 'mail-outline' },
  city:           { label: 'City',             icon: 'location-outline' },
  source:         { label: 'Source',           icon: 'globe-outline' },
  car:            { label: 'Car / Product',    icon: 'car-outline' },
  campaign:       { label: 'Campaign',         icon: 'megaphone-outline' },
};

const DEFAULT_FIELD_KEYS = Object.keys(DEFAULT_FIELD_META);

export default function LeadCardSettingsScreen() {
  const navigation = useNavigation<any>();
  const {
    fields, isLoading, isSaving,
    fetchSettings, saveSettings,
    toggleField, moveFieldUp, moveFieldDown,
    setFields,
  } = useLeadCardSettingsStore();
  const { fields: customFields, fetchFields } = useCustomFieldStore();

  const [localFields, setLocalFields] = useState<LeadCardField[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // Fetch settings + custom fields on mount
  useEffect(() => {
    fetchSettings();
    fetchFields();
  }, []);

  // Jab settings ya custom fields aayein — merge karke localFields set karo
  useEffect(() => {
    if (isLoading) return;

    // Existing saved fields (with user's order/enabled state)
    const savedMap = new Map(fields.map((f) => [f.key, f]));

    const merged: LeadCardField[] = [];

    // 1. Default fields
    DEFAULT_FIELD_KEYS.forEach((key, idx) => {
      if (savedMap.has(key)) {
        merged.push(savedMap.get(key)!);
      } else {
        // Pehli baar — default enabled with default order
        merged.push({
          key,
          label: DEFAULT_FIELD_META[key].label,
          enabled: key === 'phone' || key === 'city', // phone+city default ON
          order: idx,
          isCustom: false,
        });
      }
    });

    // 2. Active custom fields
    customFields.forEach((cf, idx) => {
      if (savedMap.has(cf.key)) {
        merged.push(savedMap.get(cf.key)!);
      } else {
        merged.push({
          key: cf.key,
          label: cf.label,
          enabled: false, // Custom fields default OFF
          order: DEFAULT_FIELD_KEYS.length + idx,
          isCustom: true,
        });
      }
    });

    // Sort by current order
    merged.sort((a, b) => a.order - b.order);

    // Re-normalize orders to 0,1,2,...
    const normalized = merged.map((f, i) => ({ ...f, order: i }));
    setLocalFields(normalized);
  }, [fields, customFields, isLoading]);

  const sortedFields = [...localFields].sort((a, b) => a.order - b.order);

  const handleToggle = (key: string) => {
    setLocalFields((prev) =>
      prev.map((f) => f.key === key ? { ...f, enabled: !f.enabled } : f)
    );
    setIsDirty(true);
  };

  const handleMoveUp = (key: string) => {
    const sorted = [...localFields].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((f) => f.key === key);
    if (idx <= 0) return;
    const updated = [...sorted];
    const temp = updated[idx].order;
    updated[idx] = { ...updated[idx], order: updated[idx - 1].order };
    updated[idx - 1] = { ...updated[idx - 1], order: temp };
    setLocalFields(updated);
    setIsDirty(true);
  };

  const handleMoveDown = (key: string) => {
    const sorted = [...localFields].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((f) => f.key === key);
    if (idx < 0 || idx >= sorted.length - 1) return;
    const updated = [...sorted];
    const temp = updated[idx].order;
    updated[idx] = { ...updated[idx], order: updated[idx + 1].order };
    updated[idx + 1] = { ...updated[idx + 1], order: temp };
    setLocalFields(updated);
    setIsDirty(true);
  };

  const handleSave = async () => {
    try {
      await saveSettings(localFields);
      setIsDirty(false);
      Toast.show({
        type: 'success',
        text1: 'Saved!',
        text2: 'Lead card settings updated.',
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: 'Please try again.',
      });
    }
  };

  const enabledCount = localFields.filter((f) => f.enabled).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Lead Data Card</Text>
          <Text style={styles.headerSubtitle}>
            {enabledCount} field{enabledCount !== 1 ? 's' : ''} visible
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.saveBtn, (!isDirty || isSaving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!isDirty || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.infoText}>
              Choose which fields appear on each lead card in the list. Name is always shown.
              Use arrows to reorder.
            </Text>
          </View>

          {/* Fixed field — always shown */}
          <Text style={styles.sectionLabel}>Always Visible</Text>
          <View style={styles.fieldCard}>
            <View style={styles.fieldRow}>
              <View style={styles.fieldIconWrap}>
                <Ionicons name="person-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.fieldLabel}>Name</Text>
              <View style={styles.fixedBadge}>
                <Text style={styles.fixedBadgeText}>Fixed</Text>
              </View>
            </View>
          </View>

          {/* Toggleable fields */}
          <Text style={styles.sectionLabel}>Customise Fields</Text>
          <View style={styles.fieldCard}>
            {sortedFields.map((field, idx) => {
              const meta = DEFAULT_FIELD_META[field.key];
              const iconName = meta?.icon || 'apps-outline';
              const isFirst = idx === 0;
              const isLast = idx === sortedFields.length - 1;

              return (
                <View key={field.key}>
                  {idx > 0 && <View style={styles.rowDivider} />}
                  <View style={styles.fieldRow}>
                    {/* Icon */}
                    <View style={[
                      styles.fieldIconWrap,
                      field.isCustom && styles.customFieldIcon,
                    ]}>
                      <Ionicons
                        name={field.isCustom ? 'code-slash-outline' : iconName as any}
                        size={18}
                        color={field.isCustom ? colors.warning : colors.primary}
                      />
                    </View>

                    {/* Label */}
                    <View style={styles.fieldLabelWrap}>
                      <Text style={[
                        styles.fieldLabel,
                        !field.enabled && styles.fieldLabelDisabled,
                      ]}>
                        {field.label}
                      </Text>
                      {field.isCustom && (
                        <Text style={styles.customTag}>Custom Field</Text>
                      )}
                    </View>

                    {/* Up/Down arrows */}
                    <View style={styles.arrowBtns}>
                      <TouchableOpacity
                        style={[styles.arrowBtn, isFirst && styles.arrowBtnDisabled]}
                        onPress={() => handleMoveUp(field.key)}
                        disabled={isFirst}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons
                          name="chevron-up"
                          size={18}
                          color={isFirst ? colors.textLight : colors.textSecondary}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.arrowBtn, isLast && styles.arrowBtnDisabled]}
                        onPress={() => handleMoveDown(field.key)}
                        disabled={isLast}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons
                          name="chevron-down"
                          size={18}
                          color={isLast ? colors.textLight : colors.textSecondary}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Toggle */}
                    <Switch
                      value={field.enabled}
                      onValueChange={() => handleToggle(field.key)}
                      trackColor={{ false: colors.border, true: colors.primaryLight }}
                      thumbColor={field.enabled ? colors.primary : colors.textLight}
                    />
                  </View>
                </View>
              );
            })}
          </View>

          {/* Bottom note */}
          <Text style={styles.bottomNote}>
            These settings are personal — only you will see this layout.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  backBtn: {
    width: 36, height: 36,
    justifyContent: 'center', alignItems: 'center',
    borderRadius: 10, backgroundColor: colors.background,
  },
  headerCenter: { flex: 1 },
  headerTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    minWidth: 60,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: {
    color: colors.white,
    fontWeight: typography.semiBold,
    fontSize: typography.sm,
  },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  scrollContent: { padding: spacing.md, paddingBottom: 40 },

  infoBanner: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.primary,
    lineHeight: 18,
  },

  sectionLabel: {
    fontSize: typography.xs,
    fontWeight: typography.semiBold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
    marginLeft: 4,
  },

  fieldCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },

  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    gap: spacing.sm,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },

  fieldIconWrap: {
    width: 34, height: 34,
    borderRadius: 9,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  customFieldIcon: { backgroundColor: '#FFF7E6' },

  fieldLabelWrap: { flex: 1 },
  fieldLabel: {
    fontSize: typography.base,
    fontWeight: typography.medium,
    color: colors.textPrimary,
  },
  fieldLabelDisabled: { color: colors.textLight },
  customTag: {
    fontSize: typography.xs,
    color: colors.warning,
    marginTop: 2,
  },

  arrowBtns: {
    flexDirection: 'row',
    gap: 2,
  },
  arrowBtn: {
    width: 28, height: 28,
    justifyContent: 'center', alignItems: 'center',
    borderRadius: 6,
    backgroundColor: colors.background,
  },
  arrowBtnDisabled: { opacity: 0.3 },

  fixedBadge: {
    backgroundColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
  },
  fixedBadgeText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },

  bottomNote: {
    textAlign: 'center',
    fontSize: typography.xs,
    color: colors.textLight,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
});
