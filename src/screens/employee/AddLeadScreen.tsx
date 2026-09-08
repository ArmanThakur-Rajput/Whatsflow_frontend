import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import axiosInstance from '../../api/axiosInstance';
import { useLeadStore } from '../../store/leadStore';
import { DynamicCustomFields } from '../../components/common';
import { CustomFieldDefinition } from '../../store/customFieldStore';
import { keyboardAvoidingBehavior } from '../../utils/platform';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

const PHONE_REGEX = /^\d{10}$/;

function validate(fields: {
  name: string; primaryPhone: string; secondaryPhone: string; email: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!fields.name.trim()) errors.name = 'Name is required';
  if (!fields.primaryPhone.trim()) {
    errors.primaryPhone = 'Primary phone is required';
  } else if (!PHONE_REGEX.test(fields.primaryPhone.trim())) {
    errors.primaryPhone = 'Must be a valid 10-digit number';
  }
  if (fields.secondaryPhone.trim()) {
    if (!PHONE_REGEX.test(fields.secondaryPhone.trim())) {
      errors.secondaryPhone = 'Must be a valid 10-digit number';
    } else if (fields.secondaryPhone.trim() === fields.primaryPhone.trim()) {
      errors.secondaryPhone = 'Cannot be the same as primary phone';
    }
  }
  if (fields.email.trim() && !/^\S+@\S+\.\S+$/.test(fields.email.trim())) {
    errors.email = 'Invalid email address';
  }
  return errors;
}

const Field = ({ label, icon, value, onChangeText, placeholder, keyboardType = 'default', error, maxLength, autoCapitalize = 'words' }: any) => (
  <View style={styles.fieldGroup}>
    <View style={styles.labelRow}>
      <Text style={styles.label}>{label}</Text>
    </View>
    <View style={[styles.inputWrap, error ? styles.inputWrapError : null]}>
      <Ionicons name={icon} size={18} color={error ? colors.error : colors.primary} style={styles.inputIcon} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
      />
    </View>
    {error ? (
      <View style={styles.errorRow}>
        <Ionicons name="alert-circle-outline" size={13} color={colors.error} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    ) : null}
  </View>
);

export default function AddLeadScreen() {
  const navigation = useNavigation<any>();
  const { createLead } = useLeadStore();

  const [name, setName] = useState('');
  const [primaryPhone, setPrimaryPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [campaign, setCampaign] = useState('');

  // Custom fields — fetched directly, no Zustand store
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [fieldsLoading, setFieldsLoading] = useState(true);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadFields = async () => {
      setFieldsLoading(true);
      try {
        const res = await axiosInstance.get('/custom-fields');
        setCustomFields(res.data.fields || []);
      } catch (err) {
        console.error('Failed to fetch custom fields:', err);
        setCustomFields([]);
      } finally {
        setFieldsLoading(false);
      }
    };
    loadFields();
  }, []);

  const clearError = (field: string) => {
    if (errors[field]) setErrors((prev) => { const e = { ...prev }; delete e[field]; return e; });
  };

  const setCustomFieldValue = (key: string, value: any) => {
    setCustomFieldValues((prev) => ({ ...prev, [key]: value }));
    clearError(key);
  };

  const handleSubmit = async () => {
    const validationErrors = validate({ name, primaryPhone, secondaryPhone, email });

    for (const field of customFields) {
      if (field.required) {
        const v = customFieldValues[field.key];
        if (v === undefined || v === null || String(v).trim() === '') {
          validationErrors[field.key] = `${field.label} is required`;
        }
      }
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await createLead({
        name: name.trim(),
        primaryPhone: primaryPhone.trim(),
        secondaryPhone: secondaryPhone.trim() || undefined,
        email: email.trim() || undefined,
        city: city.trim() || undefined,
        campaign: campaign.trim() || undefined,
        source: 'Manual',
        customFields: Object.keys(customFieldValues).length ? customFieldValues : undefined,
      });

      Toast.show({ type: 'success', text1: 'Lead Added ✅', text2: `${name.trim()} has been added successfully`, visibilityTime: 2500 });
      navigation.goBack();
    } catch (err: any) {
      const status = err?.response?.status;
      const msg: string = err?.response?.data?.message || 'Something went wrong';
      if (status === 409) {
        setErrors({
          primaryPhone: 'Lead already exists with this phone number.',
          secondaryPhone: secondaryPhone.trim() ? 'Lead already exists with this phone number.' : '',
        });
        Toast.show({ type: 'error', text1: 'Duplicate Lead ⚠️', text2: msg, visibilityTime: 3000 });
      } else if (status === 400) {
        Toast.show({ type: 'error', text1: 'Validation Error ❌', text2: msg, visibilityTime: 3000 });
      } else {
        Toast.show({ type: 'error', text1: 'Error ❌', text2: msg, visibilityTime: 3000 });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={keyboardAvoidingBehavior}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add New Lead</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>

            <Field label="Full Name" icon="person-outline" value={name} onChangeText={(v: string) => { setName(v); clearError('name'); }} placeholder="e.g. Rahul Sharma" error={errors.name} maxLength={120} />
            <Field label="Primary Phone" icon="call-outline" value={primaryPhone} onChangeText={(v: string) => { setPrimaryPhone(v.replace(/\D/g, '')); clearError('primaryPhone'); }} placeholder="10-digit mobile number" keyboardType="phone-pad" error={errors.primaryPhone} maxLength={10} autoCapitalize="none" />
            <Field label="Secondary Phone" icon="phone-portrait-outline" value={secondaryPhone} onChangeText={(v: string) => { setSecondaryPhone(v.replace(/\D/g, '')); clearError('secondaryPhone'); }} placeholder="10-digit mobile number" keyboardType="phone-pad" error={errors.secondaryPhone} maxLength={10} autoCapitalize="none" />
            <Field label="Email" icon="mail-outline" value={email} onChangeText={(v: string) => { setEmail(v); clearError('email'); }} placeholder="e.g. rahul@email.com" keyboardType="email-address" error={errors.email} autoCapitalize="none" />
            <Field label="City" icon="location-outline" value={city} onChangeText={setCity} placeholder="e.g. Pune" maxLength={80} />
            <Field label="Campaign" icon="megaphone-outline" value={campaign} onChangeText={setCampaign} placeholder="e.g. Summer Sale" maxLength={80} />

            {/* Admin-defined custom fields */}
            {fieldsLoading ? (
              <View style={styles.loaderRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loaderText}>Loading fields...</Text>
              </View>
            ) : customFields.length > 0 ? (
              <DynamicCustomFields fields={customFields} values={customFieldValues} onChange={setCustomFieldValue} errors={errors} />
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <>
                <Ionicons name="person-add-outline" size={20} color={colors.white} />
                <Text style={styles.submitText}>Add Lead</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.bottomPad} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.base, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.textPrimary },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.base, gap: spacing.md },
  section: { backgroundColor: colors.white, borderRadius: 16, padding: spacing.base, gap: spacing.md, elevation: 1, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  sectionTitle: { fontSize: typography.sm, fontWeight: typography.bold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.xs },
  fieldGroup: { gap: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 },
  label: { fontSize: typography.sm, fontWeight: typography.semiBold, color: colors.textPrimary },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  inputWrapError: { borderColor: colors.error, backgroundColor: '#FFF5F5' },
  inputIcon: { width: 22 },
  input: { flex: 1, fontSize: typography.base, color: colors.textPrimary },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, paddingLeft: 2 },
  errorText: { fontSize: 12, color: colors.error },
  loaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  loaderText: { fontSize: typography.sm, color: colors.textSecondary },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: spacing.md + 2, marginTop: spacing.sm, elevation: 3, shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6 },
  submitBtnDisabled: { opacity: 0.6, elevation: 0, shadowOpacity: 0 },
  submitText: { fontSize: typography.md, fontWeight: typography.bold, color: colors.white },
  bottomPad: { height: spacing.xxxl },
});
