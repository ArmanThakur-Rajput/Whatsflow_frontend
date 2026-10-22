import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { usePropertyStore, Property } from '../../../store/propertyStore';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';

// ── Helpers ───────────────────────────────────────────────────────────────────
const FLOOR_OPTIONS = ['Ground', ...Array.from({ length: 99 }, (_, i) => String(i + 1))];
const PROPERTY_TYPES = ['Flat', 'Shop', 'Plot'];
const PARKING_OPTIONS = ['Open', 'Covered', 'None'];
const WATER_OPTIONS   = ['Municipal Corporation', 'Gram Panchayat', 'Tanker', 'Boring'];
const SANCTION_OPTIONS= ['Yes', 'No'];
const LIFT_OPTIONS    = ['Yes', 'No'];
const FACING_OPTIONS  = ['North', 'South', 'East', 'West', 'North-East', 'North-West', 'South-East', 'South-West'];
const AMENITY_OPTIONS = ['Swimming Pool', 'Gym', 'Clubhouse', 'Garden', 'Security', 'CCTV', 'Power Backup', 'Terrace', 'Visitor Parking', 'Kids Play Area'];

// ── Sub-components ────────────────────────────────────────────────────────────
const SectionHeader = ({ icon, title }: { icon: string; title: string }) => (
  <View style={styles.sectionHeader}>
    <Ionicons name={icon as any} size={16} color={colors.primary} />
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

const Field = ({
  label, required, children,
}: { label: string; required?: boolean; children: React.ReactNode }) => (
  <View style={styles.field}>
    <Text style={styles.label}>
      {label}{required ? <Text style={{ color: '#EF4444' }}> *</Text> : null}
    </Text>
    {children}
  </View>
);

const TInput = ({
  value, onChange, placeholder, keyboardType, multiline,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  keyboardType?: any; multiline?: boolean;
}) => (
  <TextInput
    style={[styles.input, multiline && styles.inputMulti]}
    value={value}
    onChangeText={onChange}
    placeholder={placeholder || ''}
    placeholderTextColor={colors.textLight}
    keyboardType={keyboardType || 'default'}
    multiline={multiline}
    numberOfLines={multiline ? 3 : 1}
  />
);

const OptionPicker = ({
  options, value, onChange,
}: { options: string[]; value: string; onChange: (v: string) => void }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionScroll}>
    <View style={styles.optionRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[styles.optionChip, value === opt && styles.optionChipActive]}
          onPress={() => onChange(opt)}
        >
          <Text style={[styles.optionChipText, value === opt && styles.optionChipTextActive]}>
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  </ScrollView>
);

const MultiPicker = ({
  options, values, onChange,
}: { options: string[]; values: string[]; onChange: (v: string[]) => void }) => (
  <View style={styles.multiWrap}>
    {options.map((opt) => {
      const selected = values.includes(opt);
      return (
        <TouchableOpacity
          key={opt}
          style={[styles.optionChip, selected && styles.optionChipActive]}
          onPress={() => {
            if (selected) onChange(values.filter((v) => v !== opt));
            else onChange([...values, opt]);
          }}
        >
          {selected && <Ionicons name="checkmark" size={12} color={colors.white} />}
          <Text style={[styles.optionChipText, selected && styles.optionChipTextActive]}>{opt}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

// ── Price formatter helper ────────────────────────────────────────────────────
function formatPriceDisplay(raw: string): string {
  const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
  if (isNaN(n) || !raw) return '';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(2)} L`;
  if (n > 0)         return `₹${n.toLocaleString('en-IN')}`;
  return '';
}

// ── Floor Picker (scrollable dropdown) ───────────────────────────────────────
const FloorPicker = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <View>
      <TouchableOpacity style={styles.dropdownBtn} onPress={() => setOpen(!open)}>
        <Text style={value ? styles.dropdownValue : styles.dropdownPlaceholder}>
          {value || 'Select floor'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
      </TouchableOpacity>
      {open && (
        <View style={styles.dropdownList}>
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            {FLOOR_OPTIONS.map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.dropdownItem, value === f && styles.dropdownItemActive]}
                onPress={() => { onChange(f); setOpen(false); }}
              >
                <Text style={[styles.dropdownItemText, value === f && { color: colors.primary, fontWeight: '600' }]}>
                  {f === 'Ground' ? 'Ground Floor' : `${f}${getOrdinal(Number(f))} Floor`}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

function getOrdinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function AddPropertyScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const editProp: Property | undefined = route.params?.property;
  const isEdit = !!editProp;

  const { createProperty, updateProperty } = usePropertyStore();
  const [saving, setSaving] = React.useState(false);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [projectName,  setProjectName]  = React.useState(editProp?.projectName  || '');
  const [propertyType, setPropertyType] = React.useState(editProp?.propertyType || '');
  const [location,     setLocation]     = React.useState(editProp?.location     || '');
  const [price,        setPrice]        = React.useState(editProp?.price        || '');
  const [floor,        setFloor]        = React.useState(editProp?.floor        || '');
  const [carpetArea,   setCarpetArea]   = React.useState(editProp?.carpetArea   || '');
  const [buildupArea,  setBuildupArea]  = React.useState(editProp?.buildupArea  || '');
  const [sanction,     setSanction]     = React.useState(editProp?.sanction     || '');
  const [parking,      setParking]      = React.useState(editProp?.parking      || '');
  const [water,        setWater]        = React.useState(editProp?.water        || '');
  // optional
  const [flatConfig,   setFlatConfig]   = React.useState(editProp?.flatConfig   || '');
  const [buildingArea, setBuildingArea] = React.useState(editProp?.buildingArea || '');
  const [flatsOnFloor, setFlatsOnFloor] = React.useState(editProp?.flatsOnFloor || '');
  const [lift,         setLift]         = React.useState(editProp?.lift         || '');
  const [wings,        setWings]        = React.useState(editProp?.wings        || '');
  const [facing,       setFacing]       = React.useState(editProp?.facing       || '');
  const [amenities,    setAmenities]    = React.useState<string[]>(editProp?.amenities || []);
  const [ownerName,    setOwnerName]    = React.useState(editProp?.ownerName    || '');
  const [ownerPhone,   setOwnerPhone]   = React.useState(editProp?.ownerPhone   || '');
  const [tenantPhone,  setTenantPhone]  = React.useState(editProp?.tenantPhone  || '');
  const [gmapsLink,    setGmapsLink]    = React.useState(editProp?.gmapsLink    || '');
  const [notes,        setNotes]        = React.useState(editProp?.notes        || '');

  const priceDisplay = formatPriceDisplay(price);

  const validate = () => {
    if (!projectName.trim()) return 'Society/Project Name is required';
    if (!propertyType)       return 'Property Type is required';
    if (!location.trim())    return 'Location is required';
    if (!price.trim())       return 'Price is required';
    if (!floor)              return 'Floor is required';
    if (!sanction)           return 'Sanction is required';
    if (!parking)            return 'Parking is required';
    if (!water)              return 'Water source is required';
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { Alert.alert('Incomplete', err); return; }

    const payload: Partial<Property> = {
      projectName, propertyType, location, price, floor,
      carpetArea, buildupArea, sanction: sanction as any,
      parking: parking as any, water: water as any,
      flatConfig, buildingArea, flatsOnFloor,
      lift: lift as any, wings, facing, amenities,
      ownerName, ownerPhone, tenantPhone, gmapsLink, notes,
    };

    try {
      setSaving(true);
      if (isEdit) await updateProperty(editProp!._id, payload);
      else        await createProperty(payload);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Nav Header ── */}
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>{isEdit ? 'Edit Property' : 'Add Property'}</Text>
        <TouchableOpacity style={styles.saveHeaderBtn} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator size="small" color={colors.white} />
            : <Text style={styles.saveHeaderText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >

          {/* ═══════════════════════════════════════════════════════════
              SECTION 1 — Property Identity
          ═══════════════════════════════════════════════════════════ */}
          <SectionHeader icon="business" title="Property Details" />
          <View style={styles.section}>

            <Field label="Society / Project Name" required>
              <TInput value={projectName} onChange={setProjectName} placeholder="e.g. Green Valley CHS" />
            </Field>

            <Field label="Property Type" required>
              <OptionPicker options={PROPERTY_TYPES} value={propertyType} onChange={setPropertyType} />
            </Field>

            {propertyType === 'Flat' && (
              <Field label="Flat Configuration">
                <OptionPicker
                  options={['1RK', '1BHK', '2BHK', '3BHK', '4BHK', '4+BHK']}
                  value={flatConfig}
                  onChange={setFlatConfig}
                />
              </Field>
            )}

            <Field label="Location" required>
              <TInput value={location} onChange={setLocation} placeholder="e.g. Baner, Pune" />
            </Field>

            <Field label="Floor" required>
              <FloorPicker value={floor} onChange={setFloor} />
            </Field>

          </View>

          {/* ═══════════════════════════════════════════════════════════
              SECTION 2 — Price
          ═══════════════════════════════════════════════════════════ */}
          <SectionHeader icon="cash" title="Property Price" />
          <View style={styles.section}>

            <Field label="Price (₹)" required>
              <View style={styles.priceRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={price}
                  onChangeText={setPrice}
                  placeholder="e.g. 5500000"
                  placeholderTextColor={colors.textLight}
                  keyboardType="numeric"
                />
                {priceDisplay ? (
                  <View style={styles.priceBadge}>
                    <Text style={styles.priceBadgeText}>{priceDisplay}</Text>
                  </View>
                ) : null}
              </View>
            </Field>

          </View>

          {/* ═══════════════════════════════════════════════════════════
              SECTION 3 — Area & Building Specs
          ═══════════════════════════════════════════════════════════ */}
          <SectionHeader icon="resize" title="Area & Specifications" />
          <View style={styles.section}>

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Field label="Carpet Area">
                  <TInput value={carpetArea} onChange={setCarpetArea} placeholder="e.g. 650 sqft" />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Buildup Area">
                  <TInput value={buildupArea} onChange={setBuildupArea} placeholder="e.g. 780 sqft" />
                </Field>
              </View>
            </View>

            <Field label="Sanction" required>
              <OptionPicker options={SANCTION_OPTIONS} value={sanction} onChange={setSanction} />
            </Field>

            <Field label="Parking" required>
              <OptionPicker options={PARKING_OPTIONS} value={parking} onChange={setParking} />
            </Field>

            <Field label="Water Source" required>
              <OptionPicker options={WATER_OPTIONS} value={water} onChange={setWater} />
            </Field>

          </View>

          {/* ═══════════════════════════════════════════════════════════
              SECTION 4 — Building Info (Optional)
          ═══════════════════════════════════════════════════════════ */}
          <SectionHeader icon="layers" title="Building Info (Optional)" />
          <View style={styles.section}>

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Field label="Building Area">
                  <TInput value={buildingArea} onChange={setBuildingArea} placeholder="e.g. 2000 sqft" />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Flats on Same Floor">
                  <TInput value={flatsOnFloor} onChange={setFlatsOnFloor} placeholder="e.g. 4" keyboardType="numeric" />
                </Field>
              </View>
            </View>

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Field label="Lift">
                  <OptionPicker options={LIFT_OPTIONS} value={lift} onChange={setLift} />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Wings">
                  <TInput value={wings} onChange={setWings} placeholder="e.g. A, B, C" />
                </Field>
              </View>
            </View>

            <Field label="Facing">
              <OptionPicker options={FACING_OPTIONS} value={facing} onChange={setFacing} />
            </Field>

            <Field label="Amenities">
              <MultiPicker options={AMENITY_OPTIONS} values={amenities} onChange={setAmenities} />
            </Field>

          </View>

          {/* ═══════════════════════════════════════════════════════════
              SECTION 5 — Contact & Links (Optional)
          ═══════════════════════════════════════════════════════════ */}
          <SectionHeader icon="person" title="Contact & Links (Optional)" />
          <View style={styles.section}>

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Field label="Owner Name">
                  <TInput value={ownerName} onChange={setOwnerName} placeholder="Owner name" />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Owner Phone">
                  <TInput value={ownerPhone} onChange={setOwnerPhone} placeholder="Phone" keyboardType="phone-pad" />
                </Field>
              </View>
            </View>

            <Field label="Tenant Phone">
              <TInput value={tenantPhone} onChange={setTenantPhone} placeholder="Tenant phone" keyboardType="phone-pad" />
            </Field>

            <Field label="Google Maps Link">
              <TInput value={gmapsLink} onChange={setGmapsLink} placeholder="https://maps.google.com/..." />
            </Field>

            <Field label="Notes">
              <TInput value={notes} onChange={setNotes} placeholder="Any additional notes…" multiline />
            </Field>

          </View>

          {/* ── Save Button ── */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={colors.white} />
              : <>
                  <Ionicons name={isEdit ? 'save-outline' : 'add-circle-outline'} size={20} color={colors.white} />
                  <Text style={styles.saveBtnText}>{isEdit ? 'Update Property' : 'Add Property'}</Text>
                </>}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.background },
  navHeader:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.base, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.white },
  backBtn:         { padding: spacing.xs, marginRight: spacing.sm },
  navTitle:        { flex: 1, fontSize: typography.lg, fontWeight: typography.bold, color: colors.textPrimary },
  saveHeaderBtn:   { backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 10 },
  saveHeaderText:  { color: colors.white, fontWeight: typography.semiBold, fontSize: typography.sm },
  scroll:          { padding: spacing.base, paddingBottom: 40 },
  sectionHeader:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.xs },
  sectionTitle:    { fontSize: typography.base, fontWeight: typography.bold, color: colors.textPrimary },
  section:         { backgroundColor: colors.white, borderRadius: 16, padding: spacing.base, gap: spacing.sm, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, borderWidth: 1, borderColor: '#F0F0F0' },
  field:           { gap: 6 },
  label:           { fontSize: typography.xs, fontWeight: typography.semiBold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  input:           { backgroundColor: '#F8F8F8', borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 10, fontSize: typography.sm, color: colors.textPrimary },
  inputMulti:      { minHeight: 80, textAlignVertical: 'top' },
  priceRow:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  priceBadge:      { backgroundColor: '#ECFDF5', paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#A7F3D0' },
  priceBadgeText:  { fontSize: typography.sm, fontWeight: typography.bold, color: '#059669' },
  row2:            { flexDirection: 'row', gap: spacing.sm },
  optionScroll:    { marginTop: 2 },
  optionRow:       { flexDirection: 'row', gap: spacing.xs },
  multiWrap:       { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  optionChip:      { paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#F8F8F8', flexDirection: 'row', alignItems: 'center', gap: 3 },
  optionChipActive:{ backgroundColor: colors.primary, borderColor: colors.primary },
  optionChipText:  { fontSize: typography.xs, color: colors.textSecondary, fontWeight: typography.medium },
  optionChipTextActive: { color: colors.white, fontWeight: typography.semiBold },
  dropdownBtn:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8F8F8', borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 11 },
  dropdownValue:   { fontSize: typography.sm, color: colors.textPrimary },
  dropdownPlaceholder: { fontSize: typography.sm, color: colors.textLight },
  dropdownList:    { borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.white, marginTop: 4, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  dropdownItem:    { paddingHorizontal: spacing.base, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  dropdownItemActive: { backgroundColor: colors.primaryLight },
  dropdownItemText:{ fontSize: typography.sm, color: colors.textPrimary },
  saveBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16, marginTop: spacing.xl },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { color: colors.white, fontSize: typography.base, fontWeight: typography.bold },
});
