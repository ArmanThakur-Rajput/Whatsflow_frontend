import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { keyboardAvoidingBehavior } from '../../../utils/platform';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { usePropertyStore } from '../../../store/propertyStore';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';

const FLAT_CONFIGS = ['1RK', '1BHK', '2BHK', '3BHK', '4BHK', '4BHK+'];
const PLOT_TYPES = ['Plot'];

// ─── Simple Native Picker Dropdown ───────────────────────────────────────────
function Dropdown({
  label, value, options, onSelect, placeholder = 'Select…',
}: {
  label: string; value: string; options: string[];
  onSelect: (v: string) => void; placeholder?: string;
}) {
  return (
    <View style={formStyles.field}>
      <Text style={formStyles.label}>{label}</Text>
      <View style={formStyles.pickerWrap}>
        <Picker
          selectedValue={value}
          onValueChange={(v) => { if (v) onSelect(v); }}
          style={formStyles.picker}
          dropdownIconColor={colors.textSecondary}
        >
          <Picker.Item label={placeholder} value="" color={colors.textLight} />
          {options.map((o) => (
            <Picker.Item key={o} label={o} value={o} color={colors.textPrimary} />
          ))}
        </Picker>
      </View>
    </View>
  );
}

// ─── Multi-Select as toggle chips ─────────────────────────────────────────────
function MultiSelect({
  label, values, options, onChange, placeholder = 'Select…',
}: {
  label: string; values: string[]; options: string[];
  onChange: (v: string[]) => void; placeholder?: string;
}) {
  const toggle = (item: string) => {
    if (values.includes(item)) onChange(values.filter((v) => v !== item));
    else onChange([...values, item]);
  };
  return (
    <View style={formStyles.field}>
      <Text style={formStyles.label}>{label}</Text>
      {options.length === 0 ? (
        <Text style={formStyles.emptyHint}>No options added yet in Master Data</Text>
      ) : (
        <View style={formStyles.chipWrap}>
          {options.map((o) => {
            const sel = values.includes(o);
            return (
              <TouchableOpacity
                key={o}
                style={[formStyles.chip, sel && formStyles.chipActive]}
                onPress={() => toggle(o)}
              >
                <Text style={[formStyles.chipText, sel && formStyles.chipTextActive]}>{o}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Single Select Chips (for BHK config) ────────────────────────────────────
function SingleSelectChips({
  label, value, options, onSelect,
}: {
  label: string; value: string; options: string[];
  onSelect: (v: string) => void;
}) {
  return (
    <View style={formStyles.field}>
      {label ? <Text style={formStyles.label}>{label}</Text> : null}
      <View style={formStyles.chipWrap}>
        {options.map((o) => {
          const sel = value === o;
          return (
            <TouchableOpacity
              key={o}
              style={[formStyles.chip, sel && formStyles.chipActive]}
              onPress={() => onSelect(o)}
            >
              <Text style={[formStyles.chipText, sel && formStyles.chipTextActive]}>{o}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Price formatter ──────────────────────────────────────────────────────────
function formatPriceShort(raw: string): string {
  const num = parseFloat(raw.replace(/,/g, ''));
  if (isNaN(num) || num === 0) return '';
  if (num >= 10_000_000) return `${(num / 10_000_000).toFixed(2).replace(/\.?0+$/, '')} Cr`;
  if (num >= 100_000) return `${(num / 100_000).toFixed(2).replace(/\.?0+$/, '')} L`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1).replace(/\.?0+$/, '')}k`;
  return `${num}`;
}

// ─── Field ────────────────────────────────────────────────────────────────────
function Field({
  label, value, onChange, placeholder = '', multiline = false, keyboardType = 'default', returnKeyType = 'next', onSubmitEditing, isPrice = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean; keyboardType?: any;
  returnKeyType?: any; onSubmitEditing?: () => void; isPrice?: boolean;
}) {
  const shortForm = isPrice ? formatPriceShort(value) : '';
  return (
    <View style={formStyles.field}>
      <Text style={formStyles.label}>{label}</Text>
      <View>
        <TextInput
          style={[
            formStyles.input,
            multiline && { height: 90, textAlignVertical: 'top', paddingTop: spacing.md },
            isPrice && shortForm ? { paddingRight: 80 } : {},
          ]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textLight}
          multiline={multiline}
          keyboardType={keyboardType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={!multiline}
        />
        {isPrice && shortForm ? (
          <View style={formStyles.pricePreview}>
            <Text style={formStyles.pricePreviewText}>{shortForm}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AddPropertyScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const editId = route.params?.editId as string | undefined;
  const isEdit = !!editId;

  const { createProperty, updateProperty, getPropertyById, masterData, fetchMasterData } = usePropertyStore();

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  const [projectName, setProjectName] = useState('');
  const [intent, setIntent] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [flatConfig, setFlatConfig] = useState(''); // 1RK, 1BHK, 2BHK etc
  const [carpetArea, setCarpetArea] = useState('');
  const [buildupArea, setBuildupArea] = useState('');
  const [plotArea, setPlotArea] = useState(''); // only for Plot
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [price, setPrice] = useState('');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [parking, setParking] = useState('');
  const [notes, setNotes] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');

  const propertyTypes = masterData.filter((m) => m.category === 'propertyType').map((m) => m.value);
  const locations = masterData.filter((m) => m.category === 'location').map((m) => m.value);
  const amenityOptions = masterData.filter((m) => m.category === 'amenity').map((m) => m.value);
  const parkingOptions = masterData.filter((m) => m.category === 'parking').map((m) => m.value);

  const isFlat = propertyType === 'Flat';
  const isPlot = PLOT_TYPES.includes(propertyType);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      await fetchMasterData();
      if (isEdit) {
        try {
          const prop = await getPropertyById(editId);
          if (!mounted) return;
          setProjectName(prop.projectName);
          setIntent(prop.intent);
          setPropertyType(prop.propertyType);
          setFlatConfig(prop.flatConfig || '');
          setCarpetArea(prop.carpetArea || '');
          setBuildupArea(prop.buildupArea || '');
          setPlotArea(prop.plotArea || '');
          setLocation(prop.location);
          setAddress(prop.address || '');
          const rawPrice = (prop.price || '').replace(/\s*\(.*?\)\s*$/, '');
          setPrice(rawPrice);
          setAmenities(prop.amenities || []);
          setParking(prop.parking || '');
          setNotes(prop.notes || '');
          setOwnerName(prop.ownerName || '');
          setOwnerPhone(prop.ownerPhone || '');
          setLoading(false);
        } catch {
          if (!mounted) return;
          Toast.show({ type: 'error', text1: 'Failed to load property' });
          navigation.goBack();
        }
      }
    };
    init();
    return () => { mounted = false; };
  }, []);

  // Reset type-specific fields when property type changes
  useEffect(() => {
    const flat = propertyType === 'Flat';
    const plot = PLOT_TYPES.includes(propertyType);
    if (!flat) setFlatConfig('');
    if (!plot) setPlotArea('');
    if (plot) { setCarpetArea(''); setBuildupArea(''); }
  }, [propertyType]);

  const handleSave = async () => {
    if (!projectName.trim()) return Toast.show({ type: 'error', text1: 'Project name is required' });
    if (!intent) return Toast.show({ type: 'error', text1: 'Intent (Rent/Buy) is required' });
    if (!propertyType) return Toast.show({ type: 'error', text1: 'Property type is required' });
    if (!location) return Toast.show({ type: 'error', text1: 'Location is required' });
    if (isFlat && !flatConfig) return Toast.show({ type: 'error', text1: 'Please select configuration (1BHK, 2BHK etc)' });

    setSaving(true);
    try {
      const rawPrice = price.replace(/\s*\(.*?\)\s*$/, '').trim();
      const shortForm = formatPriceShort(rawPrice);
      const formattedPrice = rawPrice && shortForm ? `${rawPrice} (${shortForm})` : rawPrice;
      const payload = {
        projectName: projectName.trim(), intent, propertyType,
        flatConfig: isFlat ? flatConfig : '',
        carpetArea: isPlot ? '' : carpetArea,
        buildupArea: isPlot ? '' : buildupArea,
        plotArea: isPlot ? plotArea : '',
        location, address, price: formattedPrice, amenities, parking, notes, ownerName, ownerPhone,
      };
      let savedProp;
      if (isEdit) {
        savedProp = await updateProperty(editId, payload);
      } else {
        savedProp = await createProperty(payload);
      }
      Toast.show({ type: 'success', text1: isEdit ? 'Property updated!' : 'Property saved!' });
      if (!isEdit) {
        navigation.replace('UploadPropertyPhotos', { propertyId: savedProp._id });
      } else {
        navigation.navigate('UploadPropertyPhotos', { propertyId: editId, isEdit: true });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEdit ? 'Edit Property' : 'Add Property'}</Text>
          <View style={{ width: 36 }} />
        </View>
        <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Property' : 'Add Property'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={keyboardAvoidingBehavior}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {/* Property Details */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="home-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>Property Details</Text>
            </View>

            <Field label="Project Name *" value={projectName} onChange={setProjectName} placeholder="e.g. Sunrise Heights" />

            <Dropdown
              label="Intent *"
              value={intent}
              options={['rent', 'buy']}
              onSelect={setIntent}
              placeholder="Select intent…"
            />

            <Dropdown
              label="Property Type *"
              value={propertyType}
              options={propertyTypes.length ? propertyTypes : ['Flat', 'Plot', 'Villa']}
              onSelect={setPropertyType}
              placeholder="Select property type…"
            />

            {/* Flat Configuration — only shown when Flat is selected */}
            {isFlat && (
              <View style={styles.configSection}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="grid-outline" size={16} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Configuration *</Text>
                </View>
                <SingleSelectChips
                  label=""
                  value={flatConfig}
                  options={FLAT_CONFIGS}
                  onSelect={setFlatConfig}
                />
              </View>
            )}

            {/* Area fields — Plot shows only one field, others show carpet+buildup */}
            {isPlot ? (
              <Field
                label="Area (sqft)"
                value={plotArea}
                onChange={setPlotArea}
                placeholder="e.g. 1200"
                keyboardType="numeric"
              />
            ) : (
              <>
                <Field label="Carpet Area (sqft)" value={carpetArea} onChange={setCarpetArea} placeholder="e.g. 850" keyboardType="numeric" />
                <Field label="Buildup Area (sqft)" value={buildupArea} onChange={setBuildupArea} placeholder="e.g. 1100" keyboardType="numeric" />
              </>
            )}

            <Dropdown
              label="Location *"
              value={location}
              options={locations}
              onSelect={setLocation}
              placeholder="Select location…"
            />

            <Field label="Address" value={address} onChange={setAddress} placeholder="Full address" multiline />
            <Field
              label="Price"
              value={price}
              onChange={(v) => setPrice(v.replace(/[^0-9,]/g, ''))}
              placeholder="e.g. 4500000"
              keyboardType="numeric"
              isPrice
            />

            <MultiSelect
              label="Amenities"
              values={amenities}
              options={amenityOptions}
              onChange={setAmenities}
              placeholder="Select amenities…"
            />

            <Dropdown
              label="Parking"
              value={parking}
              options={parkingOptions}
              onSelect={setParking}
              placeholder="Select parking…"
            />

            <Field label="Notes" value={notes} onChange={setNotes} placeholder="Any additional notes…" multiline />
          </View>

          {/* Owner Details */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>Owner Details <Text style={styles.optional}>(Optional)</Text></Text>
            </View>
            <Field
              label="Owner Name"
              value={ownerName}
              onChange={setOwnerName}
              placeholder="Owner's full name"
              returnKeyType="next"
            />
            <Field
              label="Phone Number"
              value={ownerPhone}
              onChange={setOwnerPhone}
              placeholder="e.g. 9876543210"
              keyboardType="phone-pad"
              returnKeyType="done"
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={colors.white} />
              : <>
                  <Ionicons name="arrow-forward-circle-outline" size={20} color={colors.white} />
                  <Text style={styles.saveBtnText}>Save & Upload Photos</Text>
                </>
            }
          </TouchableOpacity>

          <View style={{ height: 40 }} />
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
    backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.textPrimary },
  content: { padding: spacing.base, gap: spacing.md },
  section: {
    backgroundColor: colors.white, borderRadius: 16,
    padding: spacing.base, gap: spacing.sm,
    elevation: 1, shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  configSection: {
    backgroundColor: colors.primaryLight, borderRadius: 12,
    padding: spacing.md, gap: spacing.sm,
    borderWidth: 1.5, borderColor: colors.primary + '30',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  sectionTitle: { fontSize: typography.md, fontWeight: typography.bold, color: colors.textPrimary },
  optional: { fontSize: typography.sm, fontWeight: '400', color: colors.textLight },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: spacing.md + 2, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: spacing.sm,
    marginTop: spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: typography.md, fontWeight: typography.bold, color: colors.white },
});

const INPUT_HEIGHT = 50;

const formStyles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: typography.sm, fontWeight: typography.semiBold, color: colors.textPrimary, marginBottom: 2 },
  pickerWrap: {
    backgroundColor: colors.background, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.border,
    overflow: 'hidden', height: INPUT_HEIGHT, justifyContent: 'center',
  },
  picker: { height: INPUT_HEIGHT, color: colors.textPrimary, marginTop: -2 },
  input: {
    backgroundColor: colors.background, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: INPUT_HEIGHT,
    fontSize: typography.base, color: colors.textPrimary,
    textAlignVertical: 'center',
    paddingTop: 0,
    paddingBottom: 0,
    includeFontPadding: false,
  },
  emptyHint: { fontSize: typography.xs, color: colors.textLight, fontStyle: 'italic', paddingVertical: spacing.xs },
  pricePreview: {
    position: 'absolute', right: 12, top: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.primaryLight, borderRadius: 8,
    paddingHorizontal: 8, margin: 6,
  },
  pricePreviewText: { fontSize: typography.xs, fontWeight: typography.bold, color: colors.primary },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingVertical: spacing.sm + 2,
    borderRadius: 20, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.background,
    width: '31%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipText: { fontSize: typography.sm, color: colors.textSecondary, textAlign: 'center' },
  chipTextActive: { color: colors.primary, fontWeight: typography.semiBold },
});
