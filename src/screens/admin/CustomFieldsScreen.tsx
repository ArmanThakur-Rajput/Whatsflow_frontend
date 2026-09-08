import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, TextInput, Modal, ActivityIndicator, KeyboardAvoidingView, Platform,
  Switch, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useCustomFieldStore, CustomFieldDefinition, CustomFieldType } from '../../store/customFieldStore';
import { useAuthStore } from '../../store/authStore';
import { keyboardAvoidingBehavior } from '../../utils/platform';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

// ─────────────────────────────────────────────────────────────────────────────
// Type metadata — icon + human label for each field type, used both in
// the type picker and on each field's list row.
// ─────────────────────────────────────────────────────────────────────────────
const TYPE_META: Record<CustomFieldType, { label: string; icon: string }> = {
  text: { label: 'Text', icon: 'text-outline' },
  number: { label: 'Number', icon: 'calculator-outline' },
  select: { label: 'Dropdown', icon: 'chevron-down-circle-outline' },
  date: { label: 'Date', icon: 'calendar-outline' },
};
const TYPE_OPTIONS: CustomFieldType[] = ['text', 'number', 'select', 'date'];

// ─────────────────────────────────────────────────────────────────────────────
// Add / Edit field modal
// ─────────────────────────────────────────────────────────────────────────────
function FieldEditorModal({
  visible, onClose, editingField,
}: {
  visible: boolean;
  onClose: () => void;
  editingField: CustomFieldDefinition | null;
}) {
  const { createField, updateField } = useCustomFieldStore();
  const isEditing = !!editingField;

  const [label, setLabel] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [required, setRequired] = useState(false);
  const [optionsText, setOptionsText] = useState(''); // comma-separated, raw editable text
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setLabel(editingField?.label || '');
      setType(editingField?.type || 'text');
      setRequired(editingField?.required || false);
      setOptionsText(editingField?.options.join(', ') || '');
      setError('');
    }
  }, [visible, editingField]);

  const handleSave = async () => {
    if (!label.trim()) {
      setError('Label is required');
      return;
    }

    let options: string[] = [];
    if (type === 'select') {
      options = optionsText.split(',').map((o) => o.trim()).filter(Boolean);
      if (options.length < 1) {
        setError('Add at least one option (comma-separated)');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateField(editingField._id, {
          label: label.trim(),
          required,
          // type can't change on edit — only send options if this field
          // actually is a select field.
          ...(editingField.type === 'select' ? { options } : {}),
        });
        Toast.show({ type: 'success', text1: 'Field updated ✅' });
      } else {
        await createField({ label: label.trim(), type, options, required });
        Toast.show({ type: 'success', text1: 'Field created ✅' });
      }
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Something went wrong';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>
              {isEditing ? 'Edit Field' : 'New Custom Field'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            {/* Label */}
            <Text style={modalStyles.label}>Field Name</Text>
            <TextInput
              style={modalStyles.input}
              value={label}
              onChangeText={(v) => { setLabel(v); setError(''); }}
              placeholder='e.g. "Package Type", "Loan Amount"'
              placeholderTextColor={colors.textLight}
              maxLength={60}
            />

            {/* Type — locked once created, since changing it after leads
                already have values would make existing data inconsistent. */}
            <Text style={modalStyles.label}>Field Type</Text>
            {isEditing ? (
              <View style={[modalStyles.input, modalStyles.typeLockedRow]}>
                <Ionicons name={TYPE_META[editingField.type].icon as any} size={18} color={colors.textSecondary} />
                <Text style={modalStyles.typeLockedText}>{TYPE_META[editingField.type].label}</Text>
                <Text style={modalStyles.typeLockedHint}>Can't be changed</Text>
              </View>
            ) : (
              <View style={modalStyles.typeRow}>
                {TYPE_OPTIONS.map((t) => {
                  const isActive = type === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[modalStyles.typeChip, isActive && modalStyles.typeChipActive]}
                      onPress={() => setType(t)}
                    >
                      <Ionicons
                        name={TYPE_META[t].icon as any}
                        size={16}
                        color={isActive ? colors.white : colors.textSecondary}
                      />
                      <Text style={[modalStyles.typeChipText, isActive && modalStyles.typeChipTextActive]}>
                        {TYPE_META[t].label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Options — only for select type */}
            {(type === 'select' && !isEditing) || (isEditing && editingField.type === 'select') ? (
              <>
                <Text style={modalStyles.label}>Dropdown Options</Text>
                <TextInput
                  style={[modalStyles.input, modalStyles.optionsInput]}
                  value={optionsText}
                  onChangeText={(v) => { setOptionsText(v); setError(''); }}
                  placeholder="e.g. Domestic, International, Honeymoon"
                  placeholderTextColor={colors.textLight}
                  multiline
                />
                <Text style={modalStyles.hint}>Separate each option with a comma</Text>
              </>
            ) : null}

            {/* Required toggle */}
            <View style={modalStyles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={modalStyles.label}>Required Field</Text>
                <Text style={modalStyles.hint}>Must be filled when creating a lead</Text>
              </View>
              <Switch
                value={required}
                onValueChange={setRequired}
                trackColor={{ false: colors.border, true: colors.primary + '80' }}
                thumbColor={required ? colors.primary : colors.white}
              />
            </View>

            {error ? (
              <View style={modalStyles.errorRow}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
                <Text style={modalStyles.errorText}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>

          <TouchableOpacity
            style={[modalStyles.saveBtn, isSubmitting && modalStyles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={modalStyles.saveText}>{isEditing ? 'Save Changes' : 'Create Field'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
export default function CustomFieldsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const { fields, isLoading, fetchFields, deleteField } = useCustomFieldStore();

  const [refreshing, setRefreshing] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);

  const load = useCallback(() => {
    fetchFields(); // only active fields — deleted fields are gone permanently
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFields(true);
    setRefreshing(false);
  };

  const openCreate = () => {
    setEditingField(null);
    setEditorVisible(true);
  };

  const openEdit = (field: CustomFieldDefinition) => {
    setEditingField(field);
    setEditorVisible(true);
  };

  const handleDelete = (field: CustomFieldDefinition) => {
    deleteField(field._id)
      .then(() => {
        Toast.show({
          type: 'success',
          text1: 'Field removed',
          text2: 'Existing leads still show their saved value for it',
        });
      })
      .catch(() => {
        Toast.show({ type: 'error', text1: 'Failed to remove field' });
      });
  };

  const activeFields = fields.slice().sort((a: any, b: any) => a.order - b.order);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Custom Fields</Text>
        {isAdmin ? (
          <TouchableOpacity onPress={openCreate} style={styles.addBtn}>
            <Ionicons name="add" size={24} color={colors.white} />
          </TouchableOpacity>
        ) : (
          <View style={styles.addBtn} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.intro}>
          {isAdmin
            ? 'Add fields specific to your business — e.g. "Package Type" for a travel agency, "Loan Amount" for a bank. They\'ll show up on the lead form for everyone in your team.'
            : 'These fields are set up by your admin and appear on the lead form for your team.'}
        </Text>

        {isLoading && !refreshing && fields.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : activeFields.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="options-outline" size={40} color={colors.textLight} />
            <Text style={styles.emptyTitle}>No custom fields yet</Text>
            <Text style={styles.emptyText}>
              Tap the + button above to add your first field.
            </Text>
          </View>
        ) : (
          activeFields.map((field) => (
            <View key={field._id} style={styles.fieldCard}>
              <View style={styles.fieldIconWrap}>
                <Ionicons name={TYPE_META[field.type].icon as any} size={20} color={colors.primary} />
              </View>
              <View style={styles.fieldInfo}>
                <View style={styles.fieldNameRow}>
                  <Text style={styles.fieldName}>{field.label}</Text>
                  {field.required && <View style={styles.requiredDot} />}
                </View>
                <Text style={styles.fieldMeta}>
                  {TYPE_META[field.type].label}
                  {field.type === 'select' ? ` · ${field.options.length} option${field.options.length === 1 ? '' : 's'}` : ''}
                  {field.required ? ' · Required' : ' · Optional'}
                </Text>
              </View>
              {isAdmin && (
                <>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(field)}>
                    <Ionicons name="create-outline" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(field)}>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          ))
        )}



        <View style={{ height: spacing.xxxl }} />
      </ScrollView>

      <FieldEditorModal
        visible={editorVisible}
        onClose={() => { setEditorVisible(false); load(); }}
        editingField={editingField}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.background,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  addBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },

  content: { padding: spacing.base, gap: spacing.sm },
  intro: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: spacing.sm,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  fieldCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm,
    elevation: 1,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  fieldCardInactive: {
    backgroundColor: colors.borderLight,
    elevation: 0,
    shadowOpacity: 0,
  },
  fieldIconWrap: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: colors.primary + '12',
    justifyContent: 'center', alignItems: 'center',
  },
  fieldIconWrapInactive: {
    backgroundColor: colors.white,
  },
  fieldInfo: { flex: 1, gap: 2 },
  fieldNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldName: {
    fontSize: typography.base,
    fontWeight: typography.semiBold,
    color: colors.textPrimary,
  },
  fieldNameInactive: { color: colors.textSecondary },
  requiredDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: colors.error,
  },
  fieldMeta: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  iconBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: colors.background,
    justifyContent: 'center', alignItems: 'center',
  },


  sectionTitle: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.md,
  },
  sectionSubtitle: {
    fontSize: typography.xs,
    color: colors.textLight,
    marginBottom: spacing.xs,
  },
});

// Modal-specific styles, kept separate since the editor is visually a
// distinct bottom-sheet rather than part of the main screen's list.
const modalStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  label: {
    fontSize: typography.sm,
    fontWeight: typography.semiBold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.base,
    color: colors.textPrimary,
  },
  optionsInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: typography.xs,
    color: colors.textLight,
    marginTop: 4,
  },

  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 4,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  typeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeChipText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  typeChipTextActive: {
    color: colors.white,
    fontWeight: typography.bold,
  },

  typeLockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  typeLockedText: {
    fontSize: typography.base,
    color: colors.textPrimary,
    flex: 1,
  },
  typeLockedHint: {
    fontSize: typography.xs,
    color: colors.textLight,
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
  },

  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.white,
  },
});
