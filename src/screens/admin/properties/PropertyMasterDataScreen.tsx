import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Modal, FlatList, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { usePropertyStore, MasterDataItem } from '../../../store/propertyStore';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';

type Category = 'location' | 'amenity' | 'parking' | 'propertyType';

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: 'propertyType', label: 'Property Types', icon: 'business-outline' },
  { key: 'location', label: 'Locations', icon: 'location-outline' },
  { key: 'amenity', label: 'Amenities', icon: 'leaf-outline' },
  { key: 'parking', label: 'Parking Options', icon: 'car-outline' },
];

function CategorySection({
  category, items, onAdd, onDelete,
}: {
  category: { key: Category; label: string; icon: string };
  items: MasterDataItem[];
  onAdd: (cat: Category) => void;
  onDelete: (id: string, value: string) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name={category.icon as any} size={18} color={colors.primary} />
        </View>
        <Text style={styles.sectionTitle}>{category.label}</Text>
        <TouchableOpacity
          style={styles.addChipBtn}
          onPress={() => onAdd(category.key)}
        >
          <Ionicons name="add" size={16} color={colors.primary} />
          <Text style={styles.addChipText}>Add</Text>
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <Text style={styles.emptyChip}>No {category.label.toLowerCase()} added yet</Text>
      ) : (
        <View style={styles.chipsWrap}>
          {items.map((item) => (
            <View key={item._id} style={styles.chip}>
              <Text style={styles.chipText}>{item.value}</Text>
              <TouchableOpacity
                onPress={() => onDelete(item._id, item.value)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="close-circle" size={16} color={colors.textLight} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function PropertyMasterDataScreen() {
  const navigation = useNavigation<any>();
  const { masterData, fetchMasterData, addMasterData, deleteMasterData } = usePropertyStore();
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [addCategory, setAddCategory] = useState<Category>('propertyType');
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMasterData().then(() => setLoading(false));
  }, []);

  const openAdd = (cat: Category) => {
    setAddCategory(cat);
    setNewValue('');
    setAddModal(true);
  };

  const handleAdd = async () => {
    if (!newValue.trim()) return;
    setSaving(true);
    try {
      await addMasterData(addCategory, newValue.trim());
      Toast.show({ type: 'success', text1: 'Added successfully' });
      setAddModal(false);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Failed to add' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string, value: string) => {
    Alert.alert('Remove', `Remove "${value}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await deleteMasterData(id);
            Toast.show({ type: 'success', text1: 'Removed' });
          } catch {
            Toast.show({ type: 'error', text1: 'Failed to remove' });
          }
        },
      },
    ]);
  };

  const itemsFor = (cat: Category) => masterData.filter((m) => m.category === cat);
  const catLabel = CATEGORIES.find((c) => c.key === addCategory)?.label || '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Master Data</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.infoText}>
              These values appear in dropdowns when adding properties. Add as many as your inventory requires.
            </Text>
          </View>

          {CATEGORIES.map((cat) => (
            <CategorySection
              key={cat.key}
              category={cat}
              items={itemsFor(cat.key)}
              onAdd={openAdd}
              onDelete={handleDelete}
            />
          ))}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Add Modal */}
      <Modal visible={addModal} transparent animationType="slide" onRequestClose={() => setAddModal(false)}>
        <TouchableOpacity style={styles.overlay} onPress={() => setAddModal(false)} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Add {catLabel}</Text>
          <TextInput
            style={styles.input}
            value={newValue}
            onChangeText={setNewValue}
            placeholder={`e.g. ${addCategory === 'location' ? 'Baner, Pune' : addCategory === 'amenity' ? 'Swimming Pool' : addCategory === 'parking' ? '2-Wheeler' : 'Flat'}`}
            placeholderTextColor={colors.textLight}
            autoFocus
          />
          <TouchableOpacity
            style={[styles.saveBtn, (!newValue.trim() || saving) && styles.saveBtnDisabled]}
            onPress={handleAdd}
            disabled={!newValue.trim() || saving}
          >
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Add</Text>}
          </TouchableOpacity>
        </View>
      </Modal>
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
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.textPrimary },
  content: { padding: spacing.base, gap: spacing.md },
  infoBox: {
    backgroundColor: colors.primaryLight, borderRadius: 14,
    padding: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: typography.sm, color: colors.primary, lineHeight: 19 },
  section: {
    backgroundColor: colors.white, borderRadius: 16, padding: spacing.base, gap: spacing.sm,
    elevation: 1, shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: { flex: 1, fontSize: typography.md, fontWeight: typography.bold, color: colors.textPrimary },
  addChipBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primaryLight, borderRadius: 20,
    paddingHorizontal: spacing.sm, paddingVertical: 5,
  },
  addChipText: { fontSize: typography.sm, color: colors.primary, fontWeight: typography.semiBold },
  emptyChip: { fontSize: typography.sm, color: colors.textLight, fontStyle: 'italic' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.background, borderRadius: 20,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.border,
  },
  chipText: { fontSize: typography.sm, color: colors.textPrimary },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: spacing.base, paddingBottom: spacing.xxl,
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: 'center', marginVertical: spacing.sm,
  },
  sheetTitle: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.textPrimary, marginBottom: spacing.md },
  input: {
    backgroundColor: colors.background, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    fontSize: typography.base, color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: spacing.md, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: typography.md, fontWeight: typography.bold, color: colors.white },
});
