import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, TextInput, KeyboardAvoidingView,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import axiosInstance from '../../api/axiosInstance';
import { useLeadStore } from '../../store/leadStore';
import { DynamicCustomFields } from '../../components/common';
import { CustomFieldDefinition } from '../../store/customFieldStore';
import { keyboardAvoidingBehavior } from '../../utils/platform';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

const InputField = ({
    label, value, onChangeText, placeholder,
    keyboardType, icon
}: any) => (
    <View style={styles.inputGroup}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.inputContainer}>
            <Ionicons name={icon} size={18} color={colors.primary} />
            <TextInput
                style={styles.input}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.textLight}
                keyboardType={keyboardType || 'default'}
                autoCapitalize="words"
            />
        </View>
    </View>
);

export default function EditLeadScreen() {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { leadId } = route.params || {};
    const { selectedLead, fetchLeadById } = useLeadStore();

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [city, setCity] = useState('');
    const [campaign, setCampaign] = useState('');

    // Custom fields — fetched directly via axiosInstance, no store dependency
    const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
    const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
    const [customFieldErrors, setCustomFieldErrors] = useState<Record<string, string>>({});
    const [fieldsLoading, setFieldsLoading] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch admin-defined custom fields directly — bypasses Zustand store
    // so stale/shared store state can never hide fields from the employee.
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

    // Pre-fill form when lead data is available
    useEffect(() => {
        if (selectedLead) {
            setName(selectedLead.name || '');
            setPhone(selectedLead.phone || '');
            setEmail(selectedLead.email || '');
            setCity(selectedLead.city || '');
            setCampaign(selectedLead.campaign || '');

            // selectedLead.customFields can be a Map (from MongoDB) or plain object.
            // Convert either to a plain Record so form state works correctly.
            const raw = selectedLead.customFields;
            if (raw) {
                if (typeof raw.entries === 'function') {
                    // It's a Map
                    const plain: Record<string, any> = {};
                    raw.entries().forEach(([k, v]: [string, any]) => { plain[k] = v; });
                    setCustomFieldValues(plain);
                } else {
                    setCustomFieldValues(raw as Record<string, any>);
                }
            }
        }
    }, [selectedLead]);

    const setCustomFieldValue = (key: string, value: any) => {
        setCustomFieldValues((prev) => ({ ...prev, [key]: value }));
        setCustomFieldErrors((prev) => ({ ...prev, [key]: '' }));
    };

    const handleSave = async () => {
        const cleanPhone = phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
        if (!name || !cleanPhone) {
            Toast.show({ type: 'error', text1: 'Required Fields ❌', text2: 'Name and phone are required' });
            return;
        }
        if (!/^\d{10}$/.test(cleanPhone)) {
            Toast.show({ type: 'error', text1: 'Invalid Phone ❌', text2: 'Phone must be exactly 10 digits' });
            return;
        }

        const fieldErrors: Record<string, string> = {};
        for (const field of customFields) {
            if (field.required) {
                const v = customFieldValues[field.key];
                if (v === undefined || v === null || String(v).trim() === '') {
                    fieldErrors[field.key] = `${field.label} is required`;
                }
            }
        }
        if (Object.keys(fieldErrors).length > 0) {
            setCustomFieldErrors(fieldErrors);
            Toast.show({ type: 'error', text1: 'Required Fields ❌', text2: 'Please fill in all required fields' });
            return;
        }

        setIsLoading(true);
        try {
            await axiosInstance.patch(`/leads/${leadId}/info`, {
                name, phone: cleanPhone, email, city, campaign,
                customFields: customFieldValues,
            });
            await fetchLeadById(leadId);
            Toast.show({ type: 'success', text1: 'Lead Updated ✅', text2: 'Lead information saved successfully', visibilityTime: 2000 });
            navigation.goBack();
        } catch (err: any) {
            const status = err?.response?.status;
            const msg: string = err?.response?.data?.message || 'Could not update lead information';
            if (status === 409) {
                Toast.show({ type: 'error', text1: 'Duplicate Phone ⚠️', text2: msg, visibilityTime: 3000 });
            } else {
                Toast.show({ type: 'error', text1: 'Update Failed ❌', text2: msg });
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>Edit Lead Info</Text>
                <TouchableOpacity
                    style={[styles.saveBtn, isLoading && { opacity: 0.6 }]}
                    onPress={handleSave}
                    disabled={isLoading}
                >
                    <Text style={styles.saveBtnText}>{isLoading ? 'Saving...' : 'Save'}</Text>
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={keyboardAvoidingBehavior}>
                <ScrollView
                    contentContainerStyle={[styles.content, { paddingBottom: 300 }]}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="none"
                >
                    {/* Customer Info */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Customer Information</Text>
                        <InputField label="Full Name *" value={name} onChangeText={setName} placeholder="Enter customer name" icon="person-outline" />
                        <InputField label="Phone *" value={phone} onChangeText={setPhone} placeholder="Enter phone number" keyboardType="phone-pad" icon="call-outline" />
                        <InputField label="Email" value={email} onChangeText={setEmail} placeholder="Enter email address" keyboardType="email-address" icon="mail-outline" />
                        <InputField label="City" value={city} onChangeText={setCity} placeholder="Enter city" icon="location-outline" />
                    </View>

                    {/* Lead Info */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Lead Information</Text>
                        <InputField label="Campaign" value={campaign} onChangeText={setCampaign} placeholder="Enter campaign name" icon="megaphone-outline" />
                    </View>

                    {/* Admin-defined Custom Fields */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Additional Information</Text>
                        {fieldsLoading ? (
                            <View style={styles.loaderRow}>
                                <ActivityIndicator size="small" color={colors.primary} />
                                <Text style={styles.loaderText}>Loading fields...</Text>
                            </View>
                        ) : customFields.length > 0 ? (
                            <DynamicCustomFields
                                fields={customFields}
                                values={customFieldValues}
                                onChange={setCustomFieldValue}
                                errors={customFieldErrors}
                            />
                        ) : (
                            <Text style={styles.noFieldsText}>No additional fields defined.</Text>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.base, paddingVertical: spacing.md,
        backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, borderRadius: 10 },
    title: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.textPrimary },
    saveBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 10 },
    saveBtnText: { color: colors.white, fontWeight: typography.bold, fontSize: typography.sm },
    content: { padding: spacing.base, gap: spacing.md },
    section: {
        backgroundColor: colors.white, borderRadius: 16, padding: spacing.base, gap: spacing.md,
        elevation: 1, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
    },
    sectionTitle: { fontSize: typography.md, fontWeight: typography.bold, color: colors.textPrimary, marginBottom: spacing.xs },
    inputGroup: { gap: spacing.xs },
    label: { fontSize: typography.sm, fontWeight: typography.semiBold, color: colors.textPrimary },
    inputContainer: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background,
        borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        gap: spacing.sm, borderWidth: 1, borderColor: colors.border,
    },
    input: { flex: 1, fontSize: typography.base, color: colors.textPrimary },
    loaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
    loaderText: { fontSize: typography.sm, color: colors.textSecondary },
    noFieldsText: { fontSize: typography.sm, color: colors.textSecondary, fontStyle: 'italic' },
});
