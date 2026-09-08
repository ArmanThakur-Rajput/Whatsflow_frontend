import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Platform,
  TouchableOpacity, TextInput, RefreshControl,
  ScrollView, Linking, ActivityIndicator,
  Modal, KeyboardAvoidingView, Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useLeadStore } from '../../store/leadStore';
import { useAdminStore } from '../../store/adminStore';
import { useCustomFieldStore } from '../../store/customFieldStore';
import { useLeadCardSettingsStore } from '../../store/leadCardSettingsStore';
import { DynamicLeadCard } from '../../components/leads/DynamicLeadCard';
import { DynamicCustomFields } from '../../components/common';
import { showConfirmModal } from '../../components/common/ConfirmModal';
import { LeadStatus } from '../../types/lead.types';
import { keyboardAvoidingBehavior } from '../../utils/platform';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import axiosInstance from '../../api/axiosInstance';
import Toast from 'react-native-toast-message';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';


// ─────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  'New': '#6B7280',
  'Interested': '#EF4444',
  'Contacted': '#F59E0B',
  'Not Interested': '#3B82F6',
  'Pending': '#D97706',
  'Booked': '#059669',
};

type StatusFilter = {
  label: string;
  value: string;
  icon: string;
  color: string;
};

const STATUS_FILTERS: StatusFilter[] = [
  { label: 'New', value: 'New', icon: 'list-outline', color: '#6B7280' },
  { label: 'Interested', value: 'Interested', icon: 'flame-outline', color: '#EF4444' },
  { label: 'Contacted', value: 'Contacted', icon: 'radio-button-on-outline', color: '#F59E0B' },
  { label: 'Not Interested', value: 'Not Interested', icon: 'snow-outline', color: '#3B82F6' },
  { label: 'Pending', value: 'Pending', icon: 'time-outline', color: '#D97706' },
  { label: 'Booked', value: 'Booked', icon: 'checkmark-circle-outline', color: '#059669' },
];


// ─────────────────────────────────────────────
// Date grouping helpers
// ─────────────────────────────────────────────
const formatSectionDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();

  if (isSameDay(d, today)) return 'Today';
  if (isSameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const groupLeadsByDate = (leads: any[]) => {
  const groups: Record<string, any[]> = {};
  const order: string[] = [];
  leads.forEach((lead) => {
    const key = formatSectionDate(lead.createdAt);
    if (!groups[key]) { groups[key] = []; order.push(key); }
    groups[key].push(lead);
  });
  return order.map((title) => ({ title, data: groups[title] }));
};

const PHONE_REGEX = /^\d{10}$/;
const EMPTY_FORM = {
  name: '', primaryPhone: '', secondaryPhone: '',
  email: '', city: '',
};

// ─────────────────────────────────────────────
// HighlightText — highlights matched query inside a string
// ─────────────────────────────────────────────
function HighlightText({
  text,
  query,
  textStyle,
}: {
  text: string;
  query: string;
  textStyle?: any;
}) {
  if (!query || !text) return <Text style={textStyle}>{text}</Text>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <Text style={textStyle}>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <Text key={i} style={{ backgroundColor: '#FFF176', color: '#1a1a1a', fontWeight: '700' }}>
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
    </Text>
  );
}

// ─────────────────────────────────────────────
// AddLeadModal
// ─────────────────────────────────────────────
interface Employee { _id: string; name: string; }

function AddLeadModal({
  visible, onClose, onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: (leadName: string) => void;
}) {
  const { createLead } = useLeadStore();
  const { fields: customFields, fetchFields } = useCustomFieldStore();

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<typeof EMPTY_FORM & { assignedTo: string }> & Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [empLoading, setEmpLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    fetchFields();
    setEmpLoading(true);
    axiosInstance.get('/admin/employees')
      .then((res) => {
        const list: Employee[] = Array.isArray(res.data)
          ? res.data
          : res.data.employees ?? [];
        setEmployees(list);
      })
      .catch(() => { })
      .finally(() => setEmpLoading(false));
  }, [visible]);

  const setField = (field: keyof typeof EMPTY_FORM) => (val: string) => {
    setForm((prev) => ({ ...prev, [field]: val }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const setCustomFieldValue = (key: string, value: any) => {
    setCustomFieldValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const resetAndClose = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setIsSubmitting(false);
    setSelectedEmployee(null);
    setCustomFieldValues({});
    onClose();
  };

  const handleSubmit = async () => {
    const errs: any = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.primaryPhone.trim()) errs.primaryPhone = 'Primary phone is required';
    else if (!PHONE_REGEX.test(form.primaryPhone)) errs.primaryPhone = 'Must be a valid 10-digit number';
    if (form.secondaryPhone.trim()) {
      if (!PHONE_REGEX.test(form.secondaryPhone)) errs.secondaryPhone = 'Must be a valid 10-digit number';
      else if (form.secondaryPhone === form.primaryPhone) errs.secondaryPhone = 'Cannot match primary phone';
    }
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      errs.email = 'Invalid email';
    }
    for (const field of customFields) {
      if (field.required) {
        const v = customFieldValues[field.key];
        if (v === undefined || v === null || String(v).trim() === '') {
          errs[field.key] = `${field.label} is required`;
        }
      }
    }
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setIsSubmitting(true);
    try {
      await createLead({
        name: form.name.trim(),
        primaryPhone: form.primaryPhone.trim(),
        secondaryPhone: form.secondaryPhone.trim() || undefined,
        email: form.email.trim() || undefined,
        city: form.city.trim() || undefined,
        source: 'Manual',
        assignedTo: selectedEmployee?._id,
        customFields: Object.keys(customFieldValues).length ? customFieldValues : undefined,
      });
      onSuccess(form.name.trim());
      resetAndClose();
    } catch (err: any) {
      const status = err?.response?.status;
      const msg: string = err?.response?.data?.message || 'Something went wrong';
      if (status === 409) {
        setErrors({
          primaryPhone: 'Lead already exists with this number.',
          secondaryPhone: form.secondaryPhone.trim() ? 'Lead already exists with this number.' : '',
        });
      } else {
        Toast.show({ type: 'error', text1: 'Error ❌', text2: msg, visibilityTime: 3000 });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={resetAndClose}>
      <KeyboardAvoidingView
        style={addStyles.kav}
        behavior={keyboardAvoidingBehavior}
      >
        <TouchableOpacity style={addStyles.overlay} activeOpacity={1} onPress={resetAndClose} />

        <View style={addStyles.sheet}>
          <View style={addStyles.handle} />

          <View style={addStyles.sheetHeader}>
            <Text style={addStyles.sheetTitle}>Add New Lead</Text>
            <TouchableOpacity onPress={resetAndClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={addStyles.scroll}
            contentContainerStyle={addStyles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={addStyles.sectionLabel}>REQUIRED</Text>

            <Text style={addStyles.label}>👤 Full Name</Text>
            <TextInput
              style={[addStyles.input, errors.name ? addStyles.inputError : null]}
              placeholder="e.g. Rahul Sharma"
              placeholderTextColor={colors.textLight}
              value={form.name}
              onChangeText={setField('name')}
              autoCapitalize="words"
              maxLength={120}
            />
            {errors.name ? <Text style={addStyles.errText}>{errors.name}</Text> : null}

            <Text style={addStyles.label}>📞 Primary Phone</Text>
            <TextInput
              style={[addStyles.input, errors.primaryPhone ? addStyles.inputError : null]}
              placeholder="10-digit mobile number"
              placeholderTextColor={colors.textLight}
              value={form.primaryPhone}
              onChangeText={(v) => setField('primaryPhone')(v.replace(/\D/g, ''))}
              keyboardType="phone-pad"
              maxLength={10}
            />
            {errors.primaryPhone ? <Text style={addStyles.errText}>{errors.primaryPhone}</Text> : null}

            <Text style={[addStyles.sectionLabel, { marginTop: spacing.md }]}>OPTIONAL</Text>

            <Text style={addStyles.label}>📱 Secondary Phone</Text>
            <TextInput
              style={[addStyles.input, errors.secondaryPhone ? addStyles.inputError : null]}
              placeholder="10-digit mobile number"
              placeholderTextColor={colors.textLight}
              value={form.secondaryPhone}
              onChangeText={(v) => setField('secondaryPhone')(v.replace(/\D/g, ''))}
              keyboardType="phone-pad"
              maxLength={10}
            />
            {errors.secondaryPhone ? <Text style={addStyles.errText}>{errors.secondaryPhone}</Text> : null}

            <Text style={addStyles.label}>✉️ Email</Text>
            <TextInput
              style={[addStyles.input, errors.email ? addStyles.inputError : null]}
              placeholder="e.g. rahul@email.com"
              placeholderTextColor={colors.textLight}
              value={form.email}
              onChangeText={setField('email')}
              keyboardType="email-address"
              autoCapitalize="none"
              maxLength={120}
            />
            {errors.email ? <Text style={addStyles.errText}>{errors.email}</Text> : null}

            <Text style={addStyles.label}>📍 City</Text>
            <TextInput
              style={addStyles.input}
              placeholder="e.g. Pune"
              placeholderTextColor={colors.textLight}
              value={form.city}
              onChangeText={setField('city')}
              autoCapitalize="words"
              maxLength={80}
            />



            <Text style={[addStyles.sectionLabel, { marginTop: spacing.md }]}>ASSIGN</Text>
            <Text style={addStyles.label}>👔 Assign to Employee</Text>

            {empLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} />
            ) : (
              <>
                <TouchableOpacity
                  style={[addStyles.input, addStyles.pickerBtn]}
                  onPress={() => setShowPicker(true)}
                >
                  <Text style={selectedEmployee ? addStyles.pickerValue : addStyles.pickerPlaceholder}>
                    {selectedEmployee ? selectedEmployee.name : 'Leave unassigned'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
                </TouchableOpacity>

                {showPicker && (
                  <View style={addStyles.pickerList}>
                    <TouchableOpacity
                      style={addStyles.pickerItem}
                      onPress={() => { setSelectedEmployee(null); setShowPicker(false); }}
                    >
                      <Text style={addStyles.pickerItemText}>— Leave unassigned</Text>
                    </TouchableOpacity>
                    {employees.map((emp) => (
                      <TouchableOpacity
                        key={emp._id}
                        style={[
                          addStyles.pickerItem,
                          selectedEmployee?._id === emp._id && addStyles.pickerItemActive,
                        ]}
                        onPress={() => { setSelectedEmployee(emp); setShowPicker(false); }}
                      >
                        <Text style={[
                          addStyles.pickerItemText,
                          selectedEmployee?._id === emp._id && addStyles.pickerItemTextActive,
                        ]}>
                          {emp.name}
                        </Text>
                        {selectedEmployee?._id === emp._id && (
                          <Ionicons name="checkmark" size={16} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            {customFields.length > 0 && (
              <>
                <Text style={[addStyles.sectionLabel, { marginTop: spacing.md }]}>ADDITIONAL INFORMATION</Text>
                <DynamicCustomFields
                  fields={customFields}
                  values={customFieldValues}
                  onChange={setCustomFieldValue}
                  errors={errors}
                />
              </>
            )}
          </ScrollView>

          <View style={addStyles.footer}>
            <TouchableOpacity style={addStyles.cancelBtn} onPress={resetAndClose}>
              <Text style={addStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[addStyles.saveBtn, isSubmitting && addStyles.btnDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? <ActivityIndicator color={colors.white} size="small" />
                : <Text style={addStyles.saveText}>Save Lead</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}


// ─────────────────────────────────────────────
// LeadFilterSheet
// ─────────────────────────────────────────────
export interface LeadFilters {
  dateFrom?: string;   // YYYY-MM-DD
  dateTo?: string;     // YYYY-MM-DD
  customFields?: Record<string, string>; // key -> selected value
}

interface LeadFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: LeadFilters) => void;
  initialFilters: LeadFilters;
  customFieldDefs: import('../../store/customFieldStore').CustomFieldDefinition[];
  leads: any[];
}

const fmt = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const parseDate = (s?: string) => (s ? new Date(s) : undefined);

function LeadFilterSheet({ visible, onClose, onApply, initialFilters, customFieldDefs, leads }: LeadFilterSheetProps) {
  const insets = useSafeAreaInsets();

  const [dateFrom, setDateFrom] = React.useState<Date | undefined>(parseDate(initialFilters.dateFrom));
  const [dateTo, setDateTo] = React.useState<Date | undefined>(parseDate(initialFilters.dateTo));
  const [cfValues, setCfValues] = React.useState<Record<string, string>>(initialFilters.customFields ?? {});
  const [openDropdown, setOpenDropdown] = React.useState<string | null>(null);

  // Android date picker state
  const [showFromPicker, setShowFromPicker] = React.useState(false);
  const [showToPicker, setShowToPicker] = React.useState(false);

  // Sync when sheet reopens with new initialFilters
  React.useEffect(() => {
    if (visible) {
      setDateFrom(parseDate(initialFilters.dateFrom));
      setDateTo(parseDate(initialFilters.dateTo));
      setCfValues(initialFilters.customFields ?? {});
      setOpenDropdown(null);
    }
  }, [visible]);

  // Show all active custom fields
  const allCustomFields = React.useMemo(
    () => customFieldDefs.filter((f) => f.isActive !== false),
    [customFieldDefs]
  );

  // For text/number fields — derive unique values from existing leads data
  const customFieldOptions = React.useMemo(() => {
    const map: Record<string, string[]> = {};
    allCustomFields.forEach((f) => {
      if (f.type === 'text' || f.type === 'number') {
        const seen = new Set<string>();
        leads.forEach((l) => {
          const val = l.customFields?.[f.key];
          if (val !== undefined && val !== null && String(val).trim()) {
            seen.add(String(val).trim());
          }
        });
        map[f.key] = Array.from(seen).sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: 'base' })
        );
      }
    });
    return map;
  }, [allCustomFields, leads]);

  // Count active filters for badge
  const activeCount =
    (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) +
    Object.values(cfValues).filter(Boolean).length;

  const handleApply = () => {
    onApply({
      dateFrom: dateFrom ? fmt(dateFrom) : undefined,
      dateTo: dateTo ? fmt(dateTo) : undefined,
      customFields: Object.keys(cfValues).length ? cfValues : undefined,
    });
    onClose();
  };

  const handleReset = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setCfValues({});
    setOpenDropdown(null);
  };

  const DateRow = ({ label, value, onPress }: { label: string; value?: Date; onPress: () => void }) => (
    <TouchableOpacity style={fStyles.dateRow} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name="calendar-outline" size={18} color={value ? colors.primary : colors.textSecondary} />
      <Text style={[fStyles.dateText, value && fStyles.dateTextActive]}>
        {value ? fmt(value) : label}
      </Text>
      {value && (
        <TouchableOpacity onPress={(e) => { e.stopPropagation(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  const DropdownField = ({ fieldKey, label, options, value, onChange }: {
    fieldKey: string; label: string; options: string[]; value: string; onChange: (v: string) => void;
  }) => {
    const isOpen = openDropdown === fieldKey;
    return (
      <View style={fStyles.dropdownWrapper}>
        <TouchableOpacity
          style={[fStyles.dropdownTrigger, value && fStyles.dropdownTriggerActive]}
          onPress={() => setOpenDropdown(isOpen ? null : fieldKey)}
          activeOpacity={0.8}
        >
          <Text style={[fStyles.dropdownLabel, value && fStyles.dropdownLabelActive]} numberOfLines={1}>
            {value || label}
          </Text>
          <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16}
            color={value ? colors.primary : colors.textSecondary} />
        </TouchableOpacity>
        {isOpen && (
          <View style={fStyles.dropdownList}>
            <TouchableOpacity style={fStyles.dropdownItem} onPress={() => { onChange(''); setOpenDropdown(null); }}>
              <Text style={fStyles.dropdownItemTextMuted}>— Clear</Text>
            </TouchableOpacity>
            {options.map((opt) => (
              <TouchableOpacity key={opt} style={[fStyles.dropdownItem, value === opt && fStyles.dropdownItemActive]}
                onPress={() => { onChange(opt); setOpenDropdown(null); }}>
                <Text style={[fStyles.dropdownItemText, value === opt && fStyles.dropdownItemTextActive]}>{opt}</Text>
                {value === opt && <Ionicons name="checkmark" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={fStyles.overlay} onPress={onClose} />
      <KeyboardAvoidingView style={fStyles.sheetWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[fStyles.sheet, { paddingBottom: insets.bottom + 8 }]}>
          {/* Handle */}
          <View style={fStyles.handle} />

          {/* Title row */}
          <View style={fStyles.titleRow}>
            <Text style={fStyles.title}>Advanced Filters</Text>
            {activeCount > 0 && (
              <View style={fStyles.badge}><Text style={fStyles.badgeText}>{activeCount}</Text></View>
            )}
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={fStyles.scroll} contentContainerStyle={fStyles.scrollContent}
            showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Date Range */}
            <Text style={fStyles.sectionLabel}>📅 DATE RANGE</Text>
            <View style={fStyles.dateGroup}>
              <View style={{ flex: 1 }}>
                <Text style={fStyles.inputLabel}>From</Text>
                <>
                  <DateRow label="Select date" value={dateFrom} onPress={() => setShowFromPicker(true)} />
                  {showFromPicker && (
                    <DateTimePicker value={dateFrom ?? new Date()} mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      maximumDate={dateTo ?? new Date()}
                      onChange={(_, d) => { setShowFromPicker(false); if (d) setDateFrom(d); }} />
                  )}
                </>
              </View>
              <View style={fStyles.dateSep}><Text style={fStyles.dateSepText}>→</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={fStyles.inputLabel}>To</Text>
                <>
                  <DateRow label="Select date" value={dateTo} onPress={() => setShowToPicker(true)} />
                  {showToPicker && (
                    <DateTimePicker value={dateTo ?? new Date()} mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      minimumDate={dateFrom} maximumDate={new Date()}
                      onChange={(_, d) => { setShowToPicker(false); if (d) setDateTo(d); }} />
                  )}
                </>
              </View>
            </View>

            {/* Custom fields — all types */}
            {allCustomFields.length > 0 && (
              <>
                <Text style={fStyles.sectionLabel}>🗂 CUSTOM FIELDS</Text>
                {allCustomFields.map((f) => (
                  <View key={f._id} style={{ marginBottom: spacing.sm }}>
                    <Text style={fStyles.inputLabel}>{f.label}</Text>

                    {f.type === 'select' && Array.isArray(f.options) && f.options.length > 0 ? (
                      <DropdownField
                        fieldKey={f.key} label={`All — ${f.label}`}
                        options={f.options} value={cfValues[f.key] ?? ''}
                        onChange={(v) => setCfValues((prev) => ({ ...prev, [f.key]: v }))}
                      />
                    ) : f.type === 'date' ? (
                      <>
                        <TouchableOpacity
                          style={fStyles.dateRow}
                          onPress={() => setOpenDropdown(openDropdown === f.key ? null : f.key)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="calendar-outline" size={18}
                            color={cfValues[f.key] ? colors.primary : colors.textSecondary} />
                          <Text style={[fStyles.dateText, cfValues[f.key] && fStyles.dateTextActive]}>
                            {cfValues[f.key] || `Select ${f.label}`}
                          </Text>
                          {cfValues[f.key] && (
                            <TouchableOpacity onPress={() => setCfValues((prev) => ({ ...prev, [f.key]: '' }))}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                            </TouchableOpacity>
                          )}
                        </TouchableOpacity>
                        {openDropdown === f.key && (
                          <DateTimePicker
                            value={cfValues[f.key] ? new Date(cfValues[f.key]) : new Date()}
                            mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(_, d) => {
                              setOpenDropdown(null);
                              if (d) setCfValues((prev) => ({ ...prev, [f.key]: fmt(d) }));
                            }}
                          />
                        )}
                      </>
                    ) : (
                      // text / number — dropdown from existing lead data
                      // if no data yet, fallback to text input
                      (customFieldOptions[f.key] ?? []).length > 0 ? (
                        <DropdownField
                          fieldKey={f.key} label={`All — ${f.label}`}
                          options={customFieldOptions[f.key]}
                          value={cfValues[f.key] ?? ''}
                          onChange={(v) => setCfValues((prev) => ({ ...prev, [f.key]: v }))}
                        />
                      ) : (
                        <TextInput
                          style={fStyles.textInput}
                          placeholder={`No data yet for ${f.label}`}
                          placeholderTextColor={colors.textLight}
                          keyboardType={f.type === 'number' ? 'numeric' : 'default'}
                          value={cfValues[f.key] ?? ''}
                          onChangeText={(v) => setCfValues((prev) => ({ ...prev, [f.key]: v }))}
                        />
                      )
                    )}
                  </View>
                ))}
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={fStyles.footer}>
            <TouchableOpacity style={fStyles.resetBtn} onPress={handleReset}>
              <Text style={fStyles.resetText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={fStyles.applyBtn} onPress={handleApply}>
              <Text style={fStyles.applyText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const fStyles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '92%',
    flex: 1,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: 'center', marginTop: spacing.sm, marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.base, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { flex: 1, fontSize: typography.lg, fontWeight: typography.bold, color: colors.textPrimary },
  badge: {
    backgroundColor: colors.primary, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.white },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.base, gap: spacing.sm },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: colors.textLight,
    letterSpacing: 0.8, marginTop: spacing.md, marginBottom: spacing.xs,
  },
  inputLabel: {
    fontSize: typography.sm, fontWeight: typography.semiBold,
    color: colors.textSecondary, marginBottom: 4,
  },
  dateGroup: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  dateSep: { paddingBottom: 10 },
  dateSepText: { fontSize: typography.lg, color: colors.textSecondary },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    padding: spacing.sm, backgroundColor: colors.background,
    minHeight: 44,
  },
  dateText: { flex: 1, fontSize: typography.sm, color: colors.textLight },
  dateTextActive: { color: colors.primary, fontWeight: '600' },
  textInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    backgroundColor: colors.background, minHeight: 44,
    fontSize: typography.sm, color: colors.textPrimary,
  },
  dropdownWrapper: { zIndex: 10 },
  dropdownTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    backgroundColor: colors.background, minHeight: 44,
  },
  dropdownTriggerActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight + '30' },
  dropdownLabel: { flex: 1, fontSize: typography.sm, color: colors.textLight },
  dropdownLabelActive: { color: colors.primary, fontWeight: '600' },
  dropdownList: {
    marginTop: 4,
    backgroundColor: colors.white, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
    elevation: 6, shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  dropdownItemActive: { backgroundColor: colors.primaryLight },
  dropdownItemText: { fontSize: typography.sm, color: colors.textPrimary },
  dropdownItemTextActive: { color: colors.primary, fontWeight: '700' },
  dropdownItemTextMuted: { fontSize: typography.sm, color: colors.textSecondary, fontStyle: 'italic' },
  footer: {
    flexDirection: 'row', gap: spacing.md,
    padding: spacing.base, borderTopWidth: 1, borderTopColor: colors.border,
  },
  resetBtn: {
    flex: 1, paddingVertical: spacing.md, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  resetText: { fontSize: typography.base, color: colors.textSecondary, fontWeight: typography.semiBold },
  applyBtn: {
    flex: 2, paddingVertical: spacing.md, borderRadius: 12,
    backgroundColor: colors.primary, alignItems: 'center',
  },
  applyText: { fontSize: typography.base, color: colors.white, fontWeight: typography.bold },
});

// ─────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────
export default function AdminLeadsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  // FIX: Previously used fetchLeads from leadStore which hits /leads (getMyLeads).
  // Even though getMyLeads doesn't filter by assignedTo for admins, it shares
  // the Zustand `leads` state with the employee flow — causing stale state issues
  // and subtle scoping bugs in production. Switch to fetchAllLeads from adminStore
  // which hits /admin/leads (getAllLeads) — the purpose-built admin endpoint.
  const { fetchAllLeads, exportLeadsCSV } = useAdminStore();
  const { createLead, softDeleteLead } = useLeadStore(); // still needed for AddLeadModal
  const { fields: customFields, fetchFields } = useCustomFieldStore();
  React.useEffect(() => { fetchFields(); }, []);

  // Lead card settings
  const {
    fields: cardFields,
    fetchSettings: fetchCardSettings,
    hasFetched: cardSettingsFetched,
  } = useLeadCardSettingsStore();

  React.useEffect(() => {
    if (!cardSettingsFetched) {
      fetchCardSettings();
    }
  }, []);

  // ── State ──────────────────────────────────────────────────────────────────
  const [leads, setLeads] = useState<any[]>([]);
  const [allLeadsRef, setAllLeadsRef] = useState<any[]>([]); // unfiltered — for dropdown options
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('New');
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [activeLeadFilters, setActiveLeadFilters] = useState<LeadFilters>({});
  const [todayCount, setTodayCount] = useState<number | null>(null);

  // ── Export CSV state ───────────────────────────────────────────────────────
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFromDate, setExportFromDate] = useState<Date>(new Date());
  const [exportToDate, setExportToDate] = useState<Date>(new Date());
  const [showExportFromPicker, setShowExportFromPicker] = useState(false);
  const [showExportToPicker, setShowExportToPicker] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Flat array for FlatList — headers are inline items (type:'header').
  // No stickyHeaderIndices: that prop + rapidly changing data triggers
  // the same Android native crash as SectionList+stickySectionHeadersEnabled
  // ("addViewAt: failed to insert view into parent, index=N count=0").
  const flatData = useMemo(() => {
    if (!leads.length) return [];

    let grouped: { title: string; data: any[] }[];
    if (activeFilter === 'New') {
      grouped = [{ title: 'New Leads', data: leads }];
    } else {
      grouped = groupLeadsByDate(leads);
    }

    const flat: any[] = [];
    grouped.forEach(({ title, data }) => {
      flat.push({ type: 'header', title, count: data.length, _id: 'header_' + title });
      data.forEach((lead) => flat.push({ type: 'lead', ...lead }));
    });
    return flat;
  }, [leads, activeFilter]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getTodayFilter = React.useCallback(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Fetch ALL leads once (no status/date filter) — used only for
  // custom field dropdown option lists, so they're always complete
  // regardless of which status tab or date filter is active.
  const loadAllLeadsForOptions = React.useCallback(async () => {
    try {
      const res = await fetchAllLeads({ limit: '500' });
      setAllLeadsRef(res.leads ?? []);
    } catch {
      // non-critical — dropdown just falls back to text input
    }
  }, [fetchAllLeads]);

  // ── Data fetching ──────────────────────────────────────────────────────────
  // Explicit args — never closes over stale state. All callers pass current values.
  const loadLeads = React.useCallback(async (
    searchVal: string,
    filterVal: string,
    extraFilters: LeadFilters = {},
  ) => {
    setIsLoading(true);
    try {
      const filters: Record<string, string> = {};

      if (searchVal.trim()) {
        filters.search = searchVal.trim();
      } else {
        filters.status = filterVal;

        if (extraFilters.dateFrom || extraFilters.dateTo) {
          if (extraFilters.dateFrom) filters.dateFrom = extraFilters.dateFrom;
          if (extraFilters.dateTo)   filters.dateTo   = extraFilters.dateTo;
        } else if (filterVal !== 'Pending') {
          filters.dateFrom = getTodayFilter();
          filters.dateTo   = getTodayFilter();
        }

        if (extraFilters.customFields) {
          Object.entries(extraFilters.customFields).forEach(([k, v]) => {
            if (v) filters[`customField_${k}`] = v;
          });
        }
      }

      const todayFilters: Record<string, string> = {
        dateFrom: getTodayFilter(),
        dateTo:   getTodayFilter(),
        limit: '1',
      };

      const [mainRes, countRes] = await Promise.all([
        fetchAllLeads(filters),
        fetchAllLeads(todayFilters),
      ]);

      setLeads(mainRes.leads ?? []);
      setTodayCount(countRes.total ?? 0);
    } catch (err: any) {
      console.error('AdminLeadsScreen loadLeads error:', err?.response?.data ?? err.message);
      setLeads([]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchAllLeads, getTodayFilter]);

  // ── Effects ────────────────────────────────────────────────────────────────
  // useFocusEffect handles ALL loads (initial mount + back-navigation).
  // useEffect only fires on user-driven search/filter changes after mount.
  // Refs carry latest values into the focus callback without recreating it.
  const searchRef = React.useRef(search);
  const filterRef = React.useRef(activeFilter);
  const extraFiltersRef = React.useRef(activeLeadFilters);
  React.useEffect(() => { searchRef.current = search; }, [search]);
  React.useEffect(() => { filterRef.current = activeFilter; }, [activeFilter]);
  React.useEffect(() => { extraFiltersRef.current = activeLeadFilters; }, [activeLeadFilters]);

  useFocusEffect(
    React.useCallback(() => {
      loadLeads(searchRef.current, filterRef.current, extraFiltersRef.current);
      loadAllLeadsForOptions();
    }, [loadLeads, loadAllLeadsForOptions])
  );

  const hasFiredOnce = React.useRef(false);
  useEffect(() => {
    if (!hasFiredOnce.current) {
      hasFiredOnce.current = true;
      return;
    }
    const t = setTimeout(() => loadLeads(search, activeFilter, activeLeadFilters), 400);
    return () => clearTimeout(t);
  }, [search, activeFilter, activeLeadFilters]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeads(search, activeFilter, activeLeadFilters);
    setRefreshing(false);
  };

  const handleLeadAdded = async (leadName: string) => {
    Toast.show({
      type: 'success',
      text1: 'Lead Added ✅',
      text2: `${leadName} has been added successfully`,
      visibilityTime: 2500,
    });
    await loadLeads(search, activeFilter, activeLeadFilters);
  };



  const enabledCardFields = useMemo(
    () => [...cardFields].filter((f) => f.enabled).sort((a, b) => a.order - b.order),
    [cardFields]
  );

  const renderLead = useCallback(({ item }: { item: any }) => {
    const handleDelete = () => {
      showConfirmModal({
        title: 'Delete Lead',
        message: `"${item.name}" ko delete karna chahte ho? Yeh Archive mein chala jayega.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        destructive: true,
        onConfirm: async () => {
          try {
            await softDeleteLead(item._id);
            setLeads((prev) => prev.filter((l) => l._id !== item._id));
            Toast.show({ type: 'success', text1: 'Lead Deleted' });
          } catch {
            Toast.show({ type: 'error', text1: 'Delete Failed', text2: 'Please try again.' });
          }
        },
      });
    };

    return (
      <DynamicLeadCard
        lead={item}
        cardFields={enabledCardFields}
        onPress={() => navigation.navigate('AdminLeadDetail', { leadId: item._id })}
        assignedToName={item.assignedTo?.name || 'Unassigned'}
        searchQuery={search}
        extraActions={
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
          </TouchableOpacity>
        }
      />
    );
  }, [enabledCardFields, search, navigation, softDeleteLead]);

  // ── Export CSV handler (ArchiveScreen pattern) ────────────────────────────
  const handleExportCSV = React.useCallback(async () => {
    setIsExporting(true);
    try {
      const pad = (n: number) => String(n).padStart(2, '0');
      const fromStr = `${exportFromDate.getFullYear()}-${pad(exportFromDate.getMonth() + 1)}-${pad(exportFromDate.getDate())}`;
      const toStr = `${exportToDate.getFullYear()}-${pad(exportToDate.getMonth() + 1)}-${pad(exportToDate.getDate())}`;

      const csvContent = await exportLeadsCSV(fromStr, toStr);

      const fileName = `Leads_Export_${fromStr}_to_${toStr}.csv`;

      if (Platform.OS === 'web') {
        // ── Web: Blob download ──
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        // ── Mobile: File save + Share sheet ──
        const fileUri = FileSystem.documentDirectory + fileName;
        await FileSystem.writeAsStringAsync(fileUri, csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/csv',
            dialogTitle: 'Save or Share Leads Export',
            UTI: 'public.comma-separated-values-text',
          });
        } else {
          Toast.show({ type: 'info', text1: 'File saved', text2: fileName });
        }
      }

      Toast.show({ type: 'success', text1: 'Leads exported successfully ✅' });
      setShowExportModal(false);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Export failed', text2: err?.message ?? 'Try again' });
    } finally {
      setIsExporting(false);
    }
  }, [exportFromDate, exportToDate, exportLeadsCSV]);

  return (
    <View style={styles.wrapper}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            Today's Leads <Text style={styles.countInline}>({todayCount ?? leads.length})</Text>
          </Text>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
              <Ionicons name="person-add" size={18} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterIconBtn, Object.keys(activeLeadFilters).some(
                (k) => activeLeadFilters[k as keyof LeadFilters] !== undefined
              ) && styles.filterIconBtnActive]}
              onPress={() => setShowFilterSheet(true)}
            >
              <Ionicons name="options-outline" size={18} color={colors.primary} />
              {Object.keys(activeLeadFilters).some(
                (k) => activeLeadFilters[k as keyof LeadFilters] !== undefined
              ) && <View style={styles.filterDot} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.exportBtn}
              onPress={() => setShowExportModal(true)}
            >
              <Ionicons name="download-outline" size={18} color="#059669" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or phone..."
            placeholderTextColor={colors.textLight}
            value={search}
            onChangeText={setSearch}
            selectionColor={colors.primary}
            cursorColor={colors.primary}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContainer}
          style={styles.filtersScroll}
        >
          {STATUS_FILTERS.map((f) => {
            const isActive = activeFilter === f.value;
            return (
              <TouchableOpacity
                key={f.value}
                style={[
                  styles.filterChip,
                  isActive && {
                    backgroundColor: `${f.color}15`,
                    borderColor: f.color,
                  },
                ]}
                onPress={() => setActiveFilter(f.value)}
              >
                <Ionicons name={f.icon as any} size={15} color={f.color} />
                <Text
                  style={[
                    styles.filterText,
                    {
                      color: isActive ? f.color : colors.textSecondary,
                      fontWeight: isActive ? '700' : '500',
                    },
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Leads List — FlatList with inline header items.
             Both SectionList+stickySectionHeadersEnabled AND FlatList+stickyHeaderIndices
             trigger Android native crash ("addViewAt: failed to insert view into parent")
             when data changes rapidly. Plain FlatList with no sticky props is crash-free. */}
        <FlatList
          data={flatData}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{item.title}</Text>
                  <Text style={styles.sectionCount}>{item.count} leads</Text>
                </View>
              );
            }
            return renderLead({ item });
          }}
          extraData={enabledCardFields}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={10}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          ListEmptyComponent={
            isLoading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={64} color={colors.textLight} />
                <Text style={styles.emptyText}>No leads found</Text>
              </View>
            )
          }
        />

        <LeadFilterSheet
          visible={showFilterSheet}
          onClose={() => setShowFilterSheet(false)}
          onApply={(f) => {
            setActiveLeadFilters(f);
            loadLeads(search, activeFilter, f);
          }}
          initialFilters={activeLeadFilters}
          customFieldDefs={customFields}
          leads={allLeadsRef}
        />

        <AddLeadModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleLeadAdded}
        />

        {/* ── Export CSV Modal ── */}
        <Modal
          visible={showExportModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowExportModal(false)}
        >
          <Pressable style={styles.exportOverlay} onPress={() => setShowExportModal(false)}>
            <Pressable style={styles.exportSheet} onPress={() => {}}>
              {/* Title */}
              <View style={styles.exportHeader}>
                <Ionicons name="download-outline" size={22} color="#059669" />
                <Text style={styles.exportTitle}>Export Leads to CSV</Text>
              </View>
              <Text style={styles.exportSubtitle}>
                Select date range based on lead creation date
              </Text>

              {/* From Date */}
              <Text style={styles.exportLabel}>From Date</Text>
              <TouchableOpacity
                style={styles.exportDateBtn}
                onPress={() => setShowExportFromPicker(true)}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                <Text style={styles.exportDateText}>
                  {exportFromDate.toLocaleDateString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </Text>
              </TouchableOpacity>
              {showExportFromPicker && (
                <DateTimePicker
                  value={exportFromDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  maximumDate={exportToDate}
                  onChange={(_e, date) => {
                    setShowExportFromPicker(Platform.OS === 'ios');
                    if (date) setExportFromDate(date);
                  }}
                />
              )}

              {/* To Date */}
              <Text style={[styles.exportLabel, { marginTop: spacing.md }]}>To Date</Text>
              <TouchableOpacity
                style={styles.exportDateBtn}
                onPress={() => setShowExportToPicker(true)}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                <Text style={styles.exportDateText}>
                  {exportToDate.toLocaleDateString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </Text>
              </TouchableOpacity>
              {showExportToPicker && (
                <DateTimePicker
                  value={exportToDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={exportFromDate}
                  maximumDate={new Date()}
                  onChange={(_e, date) => {
                    setShowExportToPicker(Platform.OS === 'ios');
                    if (date) setExportToDate(date);
                  }}
                />
              )}

              {/* Buttons */}
              <View style={styles.exportActions}>
                <TouchableOpacity
                  style={styles.exportCancelBtn}
                  onPress={() => setShowExportModal(false)}
                  disabled={isExporting}
                >
                  <Text style={styles.exportCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.exportConfirmBtn, isExporting && { opacity: 0.6 }]}
                  onPress={handleExportCSV}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="download-outline" size={16} color="#fff" />
                      <Text style={styles.exportConfirmText}>Export CSV</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: spacing.base,
    paddingTop: spacing.sm, paddingBottom: spacing.xs,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: typography.xxl, fontWeight: typography.bold, color: colors.textPrimary },
  countInline: { fontSize: typography.sm, fontWeight: typography.medium, color: colors.textSecondary },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: 10,
  },
  addBtnText: { fontSize: typography.sm, fontWeight: typography.bold, color: colors.white },
  bulkDeleteBtn: {
    backgroundColor: '#FFF0F0', padding: spacing.sm,
    borderRadius: 10, borderWidth: 1, borderColor: '#FFCDD2',
  },
  exportBtn: {
    backgroundColor: '#ECFDF5', padding: spacing.sm,
    borderRadius: 10, borderWidth: 1, borderColor: '#059669' + '40',
  },

  // Export Modal
  exportOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  exportSheet: {
    width: '100%', backgroundColor: colors.white,
    borderRadius: 18, padding: spacing.lg,
    elevation: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12,
  },
  exportHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginBottom: 4,
  },
  exportTitle: {
    fontSize: typography.lg, fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  exportSubtitle: {
    fontSize: typography.sm, color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  exportLabel: {
    fontSize: typography.sm, fontWeight: typography.semiBold,
    color: colors.textPrimary, marginBottom: spacing.xs,
  },
  exportDateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.primaryLight, borderRadius: 10,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderWidth: 1, borderColor: colors.primary + '30',
  },
  exportDateText: {
    fontSize: typography.base, color: colors.textPrimary,
    fontWeight: typography.medium,
  },
  exportActions: {
    flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg,
  },
  exportCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: colors.borderLight,
    alignItems: 'center',
  },
  exportCancelText: {
    fontSize: typography.base, color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  exportConfirmBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: spacing.xs,
    backgroundColor: '#059669', paddingVertical: 12,
    borderRadius: 10,
  },
  exportConfirmText: {
    fontSize: typography.base, color: '#fff',
    fontWeight: typography.bold,
  },
  filterIconBtn: {
    backgroundColor: colors.primaryLight, padding: spacing.sm,
    borderRadius: 10, borderWidth: 1, borderColor: colors.primary + '40',
    position: 'relative',
  },
  filterIconBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '15',
  },
  filterDot: {
    position: 'absolute', top: 4, right: 4,
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: colors.primary,
  },
  deleteBtn: {
    backgroundColor: '#FFF0F0',
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white, marginHorizontal: spacing.base,
    marginBottom: spacing.xs, borderRadius: 12,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    gap: spacing.sm, elevation: 1,
  },
  searchInput: { flex: 1, fontSize: typography.base, color: colors.textPrimary },

  filtersScroll: { flexGrow: 0, flexShrink: 0 },
  filtersContainer: {
    paddingHorizontal: spacing.base, paddingVertical: spacing.md,
    gap: spacing.sm, flexDirection: 'row', alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.border,
    height: 36, justifyContent: 'center',
  },
  filterText: { fontSize: typography.sm, color: colors.textSecondary, fontWeight: typography.medium },

  listContent: {
    paddingHorizontal: spacing.base, paddingBottom: spacing.xl,
    paddingTop: spacing.xs, gap: spacing.sm,
  },
  leadCard: {
    backgroundColor: colors.white, borderRadius: 14,
    flexDirection: 'row',
    elevation: 2, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4,
  },
  colorBar: { width: 4 },
  cardContent: { flex: 1, padding: spacing.md, gap: spacing.xs },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: typography.md, fontWeight: typography.bold, color: colors.primary },
  leadInfo: { flex: 1 },
  leadName: { fontSize: typography.base, fontWeight: typography.semiBold, color: colors.textPrimary },
  leadPhone: { fontSize: typography.sm, color: colors.textSecondary },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: typography.xs, fontWeight: typography.semiBold },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  assignedChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  assignedText: { fontSize: typography.xs, color: colors.textSecondary, maxWidth: 120 },
  actionBtns: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: { backgroundColor: colors.primaryLight, padding: spacing.sm, borderRadius: 8 },
  waBtn: { backgroundColor: '#E8FFF1' },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.base, paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: typography.sm, fontWeight: typography.bold,
    color: colors.textPrimary, letterSpacing: 0.3,
  },
  sectionCount: {
    fontSize: typography.xs, color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  emptyState: { alignItems: 'center', paddingTop: 100, gap: spacing.sm },
  emptyText: { fontSize: typography.lg, color: colors.textSecondary, fontWeight: typography.semiBold },
  customFieldRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  customFieldLabel: { fontSize: typography.xs, color: colors.textLight, fontWeight: '600' },
  customFieldValue: { fontSize: typography.xs, color: colors.textSecondary },
});

const addStyles = StyleSheet.create({
  kav: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '92%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: 'center', marginTop: spacing.sm, marginBottom: 2,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.base, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sheetTitle: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.textPrimary },
  scroll: { flexGrow: 0 },
  scrollContent: { padding: spacing.base, paddingTop: 0 },
  sectionLabel: {
    fontSize: 11, fontWeight: typography.bold, color: colors.textLight,
    letterSpacing: 0.8, marginTop: spacing.md, marginBottom: 2,
  },
  label: {
    fontSize: typography.sm, fontWeight: typography.semiBold,
    color: colors.textPrimary, marginBottom: spacing.xs, marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.background, borderRadius: 10,
    padding: spacing.md, fontSize: typography.base,
    color: colors.textPrimary, borderWidth: 1, borderColor: colors.border,
  },
  inputError: { borderColor: colors.error, backgroundColor: '#FFF5F5' },
  errText: { fontSize: 12, color: colors.error, marginTop: 3, marginLeft: 2 },
  pickerBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  pickerValue: { fontSize: typography.base, color: colors.textPrimary },
  pickerPlaceholder: { fontSize: typography.base, color: colors.textLight },
  pickerList: {
    backgroundColor: colors.white, borderRadius: 10, marginTop: 4,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  pickerItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  pickerItemActive: { backgroundColor: colors.primaryLight },
  pickerItemText: { fontSize: typography.base, color: colors.textPrimary },
  pickerItemTextActive: { color: colors.primary, fontWeight: typography.semiBold },
  statusChipRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
  },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 2,
    borderRadius: 20, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.background,
  },
  statusChipDot: { width: 8, height: 8, borderRadius: 4 },
  statusChipText: { fontSize: typography.sm, color: colors.textPrimary },
  footer: {
    flexDirection: 'row', gap: spacing.md,
    padding: spacing.base, borderTopWidth: 1, borderTopColor: colors.border,
  },
  cancelBtn: {
    flex: 1, padding: spacing.md, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  cancelText: { fontSize: typography.base, color: colors.textSecondary, fontWeight: typography.semiBold },
  saveBtn: {
    flex: 2, padding: spacing.md, borderRadius: 12,
    backgroundColor: colors.primary, alignItems: 'center',
  },
  saveText: { fontSize: typography.base, color: colors.white, fontWeight: typography.bold },
  btnDisabled: { opacity: 0.6 },
});