import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useSuperAdminStore } from '../../store/superAdminStore';
import { keyboardAvoidingBehavior } from '../../utils/platform';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

interface FieldProps {
  label: string;
  icon: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: any;
  error?: string;
  optional?: boolean;
  secure?: boolean;
}

const Field = ({ label, icon, value, onChangeText, placeholder, keyboardType = 'default', error, optional, secure }: FieldProps) => (
  <View style={styles.fieldGroup}>
    <View style={styles.labelRow}>
      <Text style={styles.label}>{label}</Text>
      {optional && <Text style={styles.optionalTag}>Optional</Text>}
    </View>
    <View style={[styles.inputWrap, error ? styles.inputWrapError : null]}>
      <Ionicons name={icon as any} size={18} color={error ? colors.error : colors.primary} style={{ width: 22 }} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        keyboardType={keyboardType}
        autoCapitalize={secure ? 'none' : 'words'}
        secureTextEntry={secure}
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

export default function SuperAdminAddAdminScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { orgId, orgName } = route.params || {};
  const isExistingOrg = !!orgId;

  const { addAdmin, addAdminToOrg } = useSuperAdminStore();

  const [newOrgName, setNewOrgName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearError = (k: string) => {
    if (errors[k]) setErrors((prev) => { const e = { ...prev }; delete e[k]; return e; });
  };

  const handleSubmit = async () => {
    const e: Record<string, string> = {};
    if (!isExistingOrg && !newOrgName.trim()) e.newOrgName = 'Organization name is required';
    if (!name.trim()) e.name = 'Admin name is required';
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Invalid email address';
    if (password.trim() && password.trim().length < 6) e.password = 'Must be at least 6 characters';

    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }

    setIsSubmitting(true);
    try {
      if (isExistingOrg) {
        await addAdminToOrg(orgId, {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          password: password.trim() || undefined,
        });
      } else {
        await addAdmin({
          orgName: newOrgName.trim(),
          businessType: businessType.trim() || undefined,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          password: password.trim() || undefined,
        });
      }

      Toast.show({
        type: 'success',
        text1: 'Admin Added ✅',
        text2: `${name.trim()} can now log in${password.trim() ? '' : ' with default password admin123'}`,
        visibilityTime: 3000,
      });
      navigation.goBack();
    } catch (err: any) {
      const status = err?.response?.status;
      const msg: string = err?.response?.data?.message || 'Something went wrong';
      if (status === 400 && msg.toLowerCase().includes('email')) {
        setErrors({ email: msg });
      }
      Toast.show({ type: 'error', text1: 'Error ❌', text2: msg, visibilityTime: 3000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={keyboardAvoidingBehavior}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isExistingOrg ? `Add Admin to ${orgName || 'Org'}` : 'New Organization & Admin'}
          </Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {!isExistingOrg && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Organization</Text>
              <Field
                label="Organization Name"
                icon="business-outline"
                value={newOrgName}
                onChangeText={(v) => { setNewOrgName(v); clearError('newOrgName'); }}
                placeholder="e.g. Skyline Travels"
                error={errors.newOrgName}
              />
              <Field
                label="Business Type"
                icon="briefcase-outline"
                value={businessType}
                onChangeText={setBusinessType}
                placeholder="e.g. Travel Agency, Bank, Real Estate"
                optional
              />
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Admin Details</Text>
            <Field
              label="Full Name"
              icon="person-outline"
              value={name}
              onChangeText={(v) => { setName(v); clearError('name'); }}
              placeholder="e.g. Priya Mehta"
              error={errors.name}
            />
            <Field
              label="Email"
              icon="mail-outline"
              value={email}
              onChangeText={(v) => { setEmail(v); clearError('email'); }}
              placeholder="e.g. priya@company.com"
              keyboardType="email-address"
              error={errors.email}
              secure
            />
            <Field
              label="Phone"
              icon="call-outline"
              value={phone}
              onChangeText={(v) => setPhone(v.replace(/\D/g, ''))}
              placeholder="10-digit mobile number"
              keyboardType="phone-pad"
              optional
              secure
            />
            <Field
              label="Password"
              icon="lock-closed-outline"
              value={password}
              onChangeText={(v) => { setPassword(v); clearError('password'); }}
              placeholder="Leave blank for default (admin123)"
              error={errors.password}
              optional
              secure
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.white} />
                <Text style={styles.submitText}>{isExistingOrg ? 'Add Admin' : 'Create Organization & Admin'}</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: spacing.xxxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.base, paddingVertical: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: typography.md, fontWeight: typography.bold, color: colors.textPrimary, flex: 1, textAlign: 'center' },

  scrollContent: { padding: spacing.base, gap: spacing.md },

  section: {
    backgroundColor: colors.white, borderRadius: 16, padding: spacing.base,
    gap: spacing.md, elevation: 1, shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: typography.sm, fontWeight: typography.bold, color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.xs,
  },

  fieldGroup: { gap: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 },
  label: { fontSize: typography.sm, fontWeight: typography.semiBold, color: colors.textPrimary },
  optionalTag: {
    fontSize: 11, color: colors.textLight, backgroundColor: colors.borderLight,
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background,
    borderRadius: 12, borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm,
  },
  inputWrapError: { borderColor: colors.error, backgroundColor: '#FFF5F5' },
  input: { flex: 1, fontSize: typography.base, color: colors.textPrimary },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, paddingLeft: 2 },
  errorText: { fontSize: 12, color: colors.error },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: spacing.md + 2,
    marginTop: spacing.sm, elevation: 3, shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6,
  },
  submitText: { fontSize: typography.md, fontWeight: typography.bold, color: colors.white },
});
