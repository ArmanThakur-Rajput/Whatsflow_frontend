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

export default function SuperAdminEditAdminScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { admin } = route.params || {};

  const { updateAdmin } = useSuperAdminStore();

  const [name, setName] = useState(admin?.name || '');
  const [email, setEmail] = useState(admin?.email || '');
  const [phone, setPhone] = useState(admin?.phone || '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearError = (k: string) => {
    if (errors[k]) setErrors((prev) => { const e = { ...prev }; delete e[k]; return e; });
  };

  const handleSubmit = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Invalid email address';

    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }

    setIsSubmitting(true);
    try {
      await updateAdmin(admin._id, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
      });
      Toast.show({ type: 'success', text1: 'Admin Updated ✅' });
      navigation.goBack();
    } catch (err: any) {
      const status = err?.response?.status;
      const msg: string = err?.response?.data?.message || 'Something went wrong';
      if (status === 400 && msg.toLowerCase().includes('email')) {
        setErrors({ email: msg });
      }
      Toast.show({ type: 'error', text1: 'Error ❌', text2: msg });
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
          <Text style={styles.headerTitle}>Edit Admin</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Full Name</Text>
              <View style={[styles.inputWrap, errors.name ? styles.inputWrapError : null]}>
                <Ionicons name="person-outline" size={18} color={errors.name ? colors.error : colors.primary} style={{ width: 22 }} />
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={(v) => { setName(v); clearError('name'); }}
                  placeholderTextColor={colors.textLight}
                />
              </View>
              {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={[styles.inputWrap, errors.email ? styles.inputWrapError : null]}>
                <Ionicons name="mail-outline" size={18} color={errors.email ? colors.error : colors.primary} style={{ width: 22 }} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(v) => { setEmail(v); clearError('email'); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor={colors.textLight}
                />
              </View>
              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Phone</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="call-outline" size={18} color={colors.primary} style={{ width: 22 }} />
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={(v) => setPhone(v.replace(/\D/g, ''))}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  placeholderTextColor={colors.textLight}
                />
              </View>
            </View>
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
                <Text style={styles.submitText}>Save Changes</Text>
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
  headerTitle: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.textPrimary },

  scrollContent: { padding: spacing.base, gap: spacing.md },

  section: {
    backgroundColor: colors.white, borderRadius: 16, padding: spacing.base,
    gap: spacing.md, elevation: 1, shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4,
  },

  fieldGroup: { gap: 4 },
  label: { fontSize: typography.sm, fontWeight: typography.semiBold, color: colors.textPrimary, marginBottom: 4 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background,
    borderRadius: 12, borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm,
  },
  inputWrapError: { borderColor: colors.error, backgroundColor: '#FFF5F5' },
  input: { flex: 1, fontSize: typography.base, color: colors.textPrimary },
  errorText: { fontSize: 12, color: colors.error, marginTop: 3, paddingLeft: 2 },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: spacing.md + 2,
    marginTop: spacing.sm, elevation: 3, shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6,
  },
  submitText: { fontSize: typography.md, fontWeight: typography.bold, color: colors.white },
});
