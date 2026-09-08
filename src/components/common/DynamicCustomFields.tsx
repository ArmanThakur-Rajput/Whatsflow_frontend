import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CustomFieldDefinition } from '../../store/customFieldStore';
import CrossPlatformDateTimePicker from './CrossPlatformDateTimePicker';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

interface Props {
  fields: CustomFieldDefinition[];
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  errors?: Record<string, string>;
}

function formatDateDisplay(value: any): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Renders one input per active custom field, in admin-defined order.
// Used identically by AddLeadScreen/AddLeadModal (create) and
// EditLeadScreen (edit) — both just pass `fields` from useCustomFieldStore
// and keep `values` as local form state keyed by each field's `key`.
export default function DynamicCustomFields({ fields, values, onChange, errors = {} }: Props) {
  const [datePickerKey, setDatePickerKey] = useState<string | null>(null);
  const [selectPickerKey, setSelectPickerKey] = useState<string | null>(null);

  if (!fields.length) return null;

  const sorted = [...fields].sort((a, b) => a.order - b.order);
  const selectField = sorted.find((f) => f.key === selectPickerKey);
  const dateField = sorted.find((f) => f.key === datePickerKey);

  return (
    <View style={styles.container}>
      {sorted.map((field) => {
        const value = values[field.key];
        const error = errors[field.key];

        return (
          <View key={field._id} style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>{field.label}</Text>
            </View>

            {/* ── text / number ── */}
            {(field.type === 'text' || field.type === 'number') && (
              <View style={[styles.inputWrap, error ? styles.inputWrapError : null]}>
                <TextInput
                  style={styles.input}
                  value={value !== undefined && value !== null ? String(value) : ''}
                  onChangeText={(text) => {
                    if (field.type === 'number') {
                      onChange(field.key, text.replace(/[^0-9.]/g, ''));
                    } else {
                      onChange(field.key, text);
                    }
                  }}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  placeholderTextColor={colors.textLight}
                  keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                  maxLength={field.type === 'text' ? 500 : 20}
                />
              </View>
            )}

            {/* ── select (dropdown) ── */}
            {field.type === 'select' && (
              <TouchableOpacity
                style={[styles.inputWrap, error ? styles.inputWrapError : null]}
                onPress={() => setSelectPickerKey(field.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.input, !value && styles.placeholderText]}>
                  {value || `Select ${field.label.toLowerCase()}`}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.textLight} />
              </TouchableOpacity>
            )}

            {/* ── date ── */}
            {field.type === 'date' && (
              <TouchableOpacity
                style={[styles.inputWrap, error ? styles.inputWrapError : null]}
                onPress={() => setDatePickerKey(field.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.input, !value && styles.placeholderText]}>
                  {value ? formatDateDisplay(value) : `Select ${field.label.toLowerCase()}`}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={colors.textLight} />
              </TouchableOpacity>
            )}

            {error ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle-outline" size={13} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </View>
        );
      })}

      {/* ── select dropdown modal (shared, one at a time) ── */}
      <Modal
        visible={!!selectField}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectPickerKey(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectPickerKey(null)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{selectField?.label}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectField?.options.map((opt) => {
                const isActive = values[selectField.key] === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.optionRow, isActive && styles.optionRowActive]}
                    onPress={() => {
                      onChange(selectField.key, opt);
                      setSelectPickerKey(null);
                    }}
                  >
                    <Text style={[styles.optionText, isActive && styles.optionTextActive]}>
                      {opt}
                    </Text>
                    {isActive && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── date picker (shared, one at a time) ── */}
      {dateField && (
        <CrossPlatformDateTimePicker
          visible={!!dateField}
          value={values[dateField.key] ? new Date(values[dateField.key]) : new Date()}
          mode="date"
          title={dateField.label}
          onChange={(selected) => onChange(dateField.key, selected.toISOString())}
          onClose={() => setDatePickerKey(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },

  fieldGroup: { gap: 4 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  label: {
    fontSize: typography.sm,
    fontWeight: typography.semiBold,
    color: colors.textPrimary,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  inputWrapError: {
    borderColor: colors.error,
    backgroundColor: '#FFF5F5',
  },
  input: {
    flex: 1,
    fontSize: typography.base,
    color: colors.textPrimary,
  },
  placeholderText: {
    color: colors.textLight,
  },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
    paddingLeft: 2,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
  },

  // Select dropdown modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: spacing.base,
    width: '100%',
    maxWidth: 360,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
  },
  optionRowActive: {
    backgroundColor: colors.primary + '12',
  },
  optionText: {
    fontSize: typography.base,
    color: colors.textPrimary,
  },
  optionTextActive: {
    color: colors.primary,
    fontWeight: typography.bold,
  },
});
