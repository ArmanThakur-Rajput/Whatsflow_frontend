import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, Linking, TextInput, Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import { usePropertyStore, LocationSummary, TypeSummary, Property } from '../../../store/propertyStore';
import axiosInstance from '../../../api/axiosInstance';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';

// ─── Price display helper ─────────────────────────────────────────────────────
function formatPrice(raw: string | undefined): string {
  if (!raw) return '';
  // If already has short form like "45000 (45k)", return as-is
  if (raw.includes('(')) return raw;
  const num = parseFloat(raw.replace(/,/g, ''));
  if (isNaN(num) || num === 0) return raw;
  let short = '';
  if (num >= 10_000_000) short = `${(num / 10_000_000).toFixed(2).replace(/\.?0+$/, '')} Cr`;
  else if (num >= 100_000) short = `${(num / 100_000).toFixed(2).replace(/\.?0+$/, '')} L`;
  else if (num >= 1_000) short = `${(num / 1_000).toFixed(1).replace(/\.?0+$/, '')}k`;
  return short ? `${raw} (${short})` : raw;
}

// ─── Highlight text ───────────────────────────────────────────────────────────
function HL({ text, query, style }: { text: string; query: string; style?: any }) {
  if (!query.trim() || !text) return <Text style={style}>{text}</Text>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <Text key={i} style={hlStyle.match}>{part}</Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
    </Text>
  );
}
const hlStyle = StyleSheet.create({
  match: { backgroundColor: '#FFF176', color: '#1a1a1a', fontWeight: '700', borderRadius: 2 },
});

// ─── Search bar ───────────────────────────────────────────────────────────────
function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <View style={sb.wrap}>
      <Ionicons name="search-outline" size={17} color={colors.textSecondary} />
      <TextInput
        style={sb.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        returnKeyType="search"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle" size={17} color={colors.textLight} />
        </TouchableOpacity>
      )}
    </View>
  );
}
const sb = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    margin: spacing.base, marginBottom: 0,
  },
  input: { flex: 1, fontSize: typography.base, color: colors.textPrimary, padding: 0 },
});

// ─── Export CSV Modal ─────────────────────────────────────────────────────────
function ExportModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [showFrom, setShowFrom] = useState(false);
  const [showTo, setShowTo] = useState(false);
  const [exporting, setExporting] = useState(false);

  const pad = (n: number) => String(n).padStart(2, '0');

  const handleExport = async () => {
    setExporting(true);
    try {
      const fromStr = `${fromDate.getFullYear()}-${pad(fromDate.getMonth() + 1)}-${pad(fromDate.getDate())}`;
      const toStr = `${toDate.getFullYear()}-${pad(toDate.getMonth() + 1)}-${pad(toDate.getDate())}`;
      const { storage } = await import('../../../utils/storage');
      const token = await storage.getToken();
      const url = `${axiosInstance.defaults.baseURL}/property-crm/export?dateFrom=${fromStr}&dateTo=${toStr}`;
      const fileName = `Properties_${fromStr}_to_${toStr}.csv`;

      if (Platform.OS === 'web') {
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error('Export failed');
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl; anchor.download = fileName;
        document.body.appendChild(anchor); anchor.click();
        document.body.removeChild(anchor); URL.revokeObjectURL(objectUrl);
      } else {
        const fileUri = FileSystem.documentDirectory + fileName;
        const downloadRes = await FileSystem.downloadAsync(url, fileUri, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadRes.uri, {
            mimeType: 'text/csv', dialogTitle: 'Save Properties Export',
            UTI: 'public.comma-separated-values-text',
          });
        }
      }
      Toast.show({ type: 'success', text1: 'Properties exported ✅' });
      onClose();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Export failed', text2: err?.message });
    } finally {
      setExporting(false);
    }
  };

  const fmtDate = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={exporting ? undefined : onClose}>
      <Pressable style={exp.overlay} onPress={exporting ? undefined : onClose}>
        <Pressable style={exp.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={exp.header}>
            <Ionicons name="download-outline" size={22} color="#059669" />
            <Text style={exp.title}>Export Properties to CSV</Text>
          </View>
          <Text style={exp.sub}>Select date range based on property creation date</Text>

          <Text style={exp.label}>From Date</Text>
          <TouchableOpacity style={exp.dateBtn} onPress={() => setShowFrom(true)}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={exp.dateText}>{fmtDate(fromDate)}</Text>
          </TouchableOpacity>
          {showFrom && (
            <DateTimePicker value={fromDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={toDate}
              onChange={(_e, d) => { setShowFrom(Platform.OS === 'ios'); if (d) setFromDate(d); }} />
          )}

          <Text style={[exp.label, { marginTop: spacing.md }]}>To Date</Text>
          <TouchableOpacity style={exp.dateBtn} onPress={() => setShowTo(true)}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={exp.dateText}>{fmtDate(toDate)}</Text>
          </TouchableOpacity>
          {showTo && (
            <DateTimePicker value={toDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={fromDate} maximumDate={new Date()}
              onChange={(_e, d) => { setShowTo(Platform.OS === 'ios'); if (d) setToDate(d); }} />
          )}

          <View style={exp.actions}>
            <TouchableOpacity style={exp.cancelBtn} onPress={onClose} disabled={exporting}>
              <Text style={exp.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[exp.confirmBtn, exporting && { opacity: 0.6 }]} onPress={handleExport} disabled={exporting}>
              {exporting ? <ActivityIndicator size="small" color="#fff" /> : (
                <><Ionicons name="download-outline" size={16} color="#fff" /><Text style={exp.confirmText}>Export CSV</Text></>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const exp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: spacing.base },
  sheet: { backgroundColor: colors.white, borderRadius: 20, padding: spacing.base, width: '100%', maxWidth: 420 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  title: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.textPrimary },
  sub: { fontSize: typography.sm, color: colors.textSecondary, marginBottom: spacing.md },
  label: { fontSize: typography.sm, fontWeight: typography.semiBold, color: colors.textPrimary, marginBottom: 6 },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.background, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
  },
  dateText: { fontSize: typography.base, color: colors.textPrimary },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  cancelBtn: { flex: 1, borderRadius: 12, paddingVertical: spacing.md, alignItems: 'center', backgroundColor: colors.background },
  cancelText: { fontSize: typography.base, fontWeight: typography.semiBold, color: colors.textSecondary },
  confirmBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, borderRadius: 12, paddingVertical: spacing.md, backgroundColor: '#059669',
  },
  confirmText: { fontSize: typography.base, fontWeight: typography.bold, color: '#fff' },
});

// ─── Status Modal ─────────────────────────────────────────────────────────────
function StatusModal({ visible, property, onClose, onStatusChange }: {
  visible: boolean; property: Property | null;
  onClose: () => void; onStatusChange: (id: string, status: 'available' | 'sold' | 'rented') => void;
}) {
  if (!property) return null;
  const OPTIONS = [
    { label: 'Available', value: 'available' as const, color: colors.success, icon: 'checkmark-circle-outline' },
    { label: 'Sold', value: 'sold' as const, color: colors.error, icon: 'close-circle-outline' },
    { label: 'Rented Out', value: 'rented' as const, color: colors.warning, icon: 'home-outline' },
  ];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={sm.overlay} onPress={onClose} />
      <View style={sm.sheet}>
        <View style={sm.handle} />
        <Text style={sm.title}>Update Status</Text>
        <Text style={sm.sub}>{property.projectName}</Text>
        {OPTIONS.map((o) => (
          <TouchableOpacity
            key={o.value}
            style={[sm.option, property.status === o.value && { backgroundColor: o.color + '10', borderRadius: 12, paddingHorizontal: spacing.sm }]}
            onPress={() => { onStatusChange(property._id, o.value); onClose(); }}
          >
            <Ionicons name={o.icon as any} size={22} color={o.color} />
            <Text style={[sm.optionText, { color: o.color }]}>{o.label}</Text>
            {property.status === o.value && <Ionicons name="checkmark" size={18} color={o.color} />}
          </TouchableOpacity>
        ))}
      </View>
    </Modal>
  );
}
const sm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: spacing.base, paddingBottom: spacing.xxl,
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginVertical: spacing.sm },
  title: { fontSize: typography.md, fontWeight: typography.bold, color: colors.textPrimary },
  sub: { fontSize: typography.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  optionText: { flex: 1, fontSize: typography.base, fontWeight: typography.semiBold },
});

// ─── Property Card ────────────────────────────────────────────────────────────
function PropertyCard({ property, query, onStatusTap, onWaTap, onDetailTap, onEditTap }: {
  property: Property; query: string;
  onStatusTap: () => void; onWaTap: () => void; onDetailTap: () => void; onEditTap: () => void;
}) {
  const statusColor = property.status === 'available' ? colors.success : property.status === 'sold' ? colors.error : colors.warning;
  return (
    <TouchableOpacity style={pc.card} onPress={onDetailTap} activeOpacity={0.85}>
      <View style={[pc.statusBadge, { backgroundColor: statusColor + '18' }]}>
        <View style={[pc.dot, { backgroundColor: statusColor }]} />
        <Text style={[pc.statusText, { color: statusColor }]}>
          {property.status === 'available' ? 'Available' : property.status === 'sold' ? 'Sold' : 'Rented'}
        </Text>
      </View>
      <HL text={property.projectName} query={query} style={pc.name} />
      <HL text={`${property.propertyType} · ${property.intent === 'buy' ? 'Buy' : 'Rent'}`} query={query} style={pc.type} />
      {property.price ? <HL text={`₹ ${formatPrice(property.price)}`} query={query} style={pc.price} /> : null}
      <View style={pc.metaRow}>
        {property.carpetArea ? <View style={pc.meta}><Ionicons name="expand-outline" size={13} color={colors.textSecondary} /><HL text={`${property.carpetArea} sqft carpet`} query={query} style={pc.metaText} /></View> : null}
        {property.buildupArea ? <View style={pc.meta}><Ionicons name="grid-outline" size={13} color={colors.textSecondary} /><HL text={`${property.buildupArea} sqft buildup`} query={query} style={pc.metaText} /></View> : null}
        {property.parking ? <View style={pc.meta}><Ionicons name="car-outline" size={13} color={colors.textSecondary} /><HL text={property.parking} query={query} style={pc.metaText} /></View> : null}
        {property.location ? <View style={pc.meta}><Ionicons name="location-outline" size={13} color={colors.textSecondary} /><HL text={property.location} query={query} style={pc.metaText} /></View> : null}
      </View>
      <View style={pc.actionsRow}>
        <TouchableOpacity style={pc.actionBtn} onPress={onWaTap}>
          <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
          <Text style={[pc.actionText, { color: '#25D366' }]}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={pc.actionBtn} onPress={onStatusTap}>
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
          <Text style={[pc.actionText, { color: colors.primary }]}>Status</Text>
        </TouchableOpacity>
        <TouchableOpacity style={pc.actionBtn} onPress={onEditTap}>
          <Ionicons name="pencil-outline" size={18} color={colors.textSecondary} />
          <Text style={[pc.actionText, { color: colors.textSecondary }]}>Edit</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}
const pc = StyleSheet.create({
  card: {
    backgroundColor: colors.white, borderRadius: 16, padding: spacing.base, gap: spacing.sm,
    elevation: 2, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4,
  },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: typography.xs, fontWeight: typography.bold },
  name: { fontSize: typography.md, fontWeight: typography.bold, color: colors.textPrimary },
  type: { fontSize: typography.sm, color: colors.textSecondary },
  price: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.primary },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: typography.xs, color: colors.textSecondary },
  actionsRow: {
    flexDirection: 'row', gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: spacing.sm, marginTop: 4,
  },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: spacing.xs + 2, backgroundColor: colors.background, borderRadius: 10 },
  actionText: { fontSize: typography.xs, fontWeight: typography.semiBold },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
// filterStatus: 'all' | 'available' | 'sold' (passed from dashboard stat cards)
type ViewLevel = 'locations' | 'types' | 'configs' | 'properties';
type StatusFilter = 'available' | 'sold' | 'rented' | 'all';
type IntentFilter = 'all' | 'rent' | 'buy';

const FLAT_CONFIGS = ['1RK', '1BHK', '2BHK', '3BHK', '4BHK', '4BHK+'];

export default function ExplorePropertiesScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const initFilter: StatusFilter = route.params?.filterStatus || 'available';

  const { locations, types, properties, fetchLocationsSummary, fetchTypesSummary, fetchProperties, setPropertyStatus, isLoading } = usePropertyStore();

  const [view, setView] = useState<ViewLevel>('locations');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedConfig, setSelectedConfig] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initFilter);
  const [intentFilter, setIntentFilter] = useState<IntentFilter>('all');
  const [soldSubTab, setSoldSubTab] = useState<'sold' | 'rented'>('sold');
  const [statusModal, setStatusModal] = useState(false);
  const [selectedProp, setSelectedProp] = useState<Property | null>(null);
  const [showExport, setShowExport] = useState(false);

  useFocusEffect(useCallback(() => { fetchLocationsSummary(); }, []));

  const selectLocation = async (loc: string) => {
    setSearch('');
    setSelectedLocation(loc);
    await fetchTypesSummary(loc);
    setView('types');
  };

  const selectType = async (type: string) => {
    setSearch('');
    setSelectedType(type);
    setSelectedConfig('');
    // BHK config screen only for 'available' — sold/rented seedha properties dikhao
    if (type === 'Flat' && statusFilter === 'available') {
      // Fetch all flat properties so we can show per-config counts
      await fetchProperties({ location: selectedLocation, propertyType: type });
      setView('configs');
    } else {
      await fetchProperties({ location: selectedLocation, propertyType: type, status: statusFilter !== 'all' ? statusFilter : undefined });
      setView('properties');
    }
  };

  const selectConfig = async (config: string) => {
    setSearch('');
    setSelectedConfig(config);
    await fetchProperties({ location: selectedLocation, propertyType: selectedType, flatConfig: config });
    setView('properties');
  };

  const handleStatusChange = async (id: string, status: 'available' | 'sold' | 'rented') => {
    try {
      await setPropertyStatus(id, status);
      Toast.show({ type: 'success', text1: `Marked as ${status}` });
      await fetchProperties({ location: selectedLocation, propertyType: selectedType });
    } catch { Toast.show({ type: 'error', text1: 'Update failed' }); }
  };

  const openWa = (prop: Property) => {
    const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '');
    const photos = prop.photos?.length
      ? `\n📸 *Photos:* ${baseUrl}/api/property-crm/properties/${prop._id}/gallery`
      : '';
    const divider = `━━━━━━━━━━━━━━━━━━━━━`;
    const heading =
      `🏢 *KIN PROPERTY MANAGEMENT*\n` +
      `_Your Trusted Real Estate Partner_\n` +
      `${divider}`;
    const body =
      `🏠 *${prop.projectName}*\n` +
      `🏷️ ${prop.propertyType}  |  ${prop.intent === 'buy' ? '🔑 For Sale' : '🤝 For Rent'}\n` +
      `📍 *Location:* ${prop.location}\n` +
      (prop.address ? `🗺️ *Address:* ${prop.address}\n` : '') +
      (prop.price ? `💰 *Price:* ₹${formatPrice(prop.price)}\n` : '') +
      (prop.carpetArea ? `📐 *Carpet Area:* ${prop.carpetArea} sqft\n` : '') +
      (prop.buildupArea ? `🏗️ *Buildup Area:* ${prop.buildupArea} sqft\n` : '') +
      (prop.parking ? `🚗 *Parking:* ${prop.parking}\n` : '') +
      (prop.amenities?.length ? `✅ *Amenities:* ${prop.amenities.join(', ')}\n` : '') +
      photos;
    const footer =
      `\n${divider}\n` +
      `📞 *Contact us for site visits & more info!*`;
    const msg = `${heading}\n\n${body}${footer}`;
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`).catch(() =>
      Toast.show({ type: 'error', text1: 'Could not open WhatsApp' })
    );
  };

  const q = search.trim().toLowerCase();

  const filteredLocations = useMemo(() => {
    if (!q) return locations;
    return locations.filter((l) => l._id.toLowerCase().includes(q));
  }, [locations, q]);

  const filteredTypes = useMemo(() => {
    if (!q) return types;
    return types.filter((t) => t._id.toLowerCase().includes(q));
  }, [types, q]);

  const filteredProperties = useMemo(() => {
    let base = properties;
    // Apply status filter
    if (statusFilter === 'available') {
      base = base.filter((p) => p.status === 'available');
    } else if (statusFilter === 'sold') {
      base = base.filter((p) => p.status === 'sold' || p.status === 'rented');
    }
    // Apply intent filter (rent / buy)
    if (intentFilter === 'rent') {
      base = base.filter((p) => p.intent === 'rent');
    } else if (intentFilter === 'buy') {
      base = base.filter((p) => p.intent === 'buy');
    }
    if (!q) return base;
    return base.filter((p) =>
      p.projectName?.toLowerCase().includes(q) ||
      p.propertyType?.toLowerCase().includes(q) ||
      p.location?.toLowerCase().includes(q) ||
      p.price?.toLowerCase().includes(q) ||
      p.address?.toLowerCase().includes(q) ||
      p.carpetArea?.toLowerCase().includes(q) ||
      p.buildupArea?.toLowerCase().includes(q) ||
      p.parking?.toLowerCase().includes(q) ||
      p.ownerName?.toLowerCase().includes(q) ||
      p.amenities?.some((a) => a.toLowerCase().includes(q)) ||
      p.notes?.toLowerCase().includes(q)
    );
  }, [properties, q, statusFilter, intentFilter]);

  const headerTitle = view === 'locations' ? 'Properties'
    : view === 'types' ? selectedLocation
    : view === 'configs' ? selectedType
    : selectedConfig ? `${selectedType} · ${selectedConfig}` : selectedType;

  const searchPlaceholder = view === 'locations' ? 'Search locations…'
    : view === 'types' ? 'Search property types…'
    : view === 'configs' ? 'Search configuration…'
    : 'Search name, price, area, amenities…';

  const goBack = () => {
    if (view === 'types') {
      setSearch('');
      setSelectedLocation('');
      setView('locations');
    } else if (view === 'configs') {
      setSearch('');
      setSelectedType('');
      setView('types');
    } else if (view === 'properties') {
      setSearch('');
      setSelectedConfig('');
      setStatusFilter(initFilter);
      setIntentFilter('all');
      // configs view sirf available Flat ke liye tha, sold/rented mein skip hua tha
      if (selectedType === 'Flat' && statusFilter === 'available') {
        setView('configs');
      } else {
        setSelectedType('');
        setView('types');
      }
    } else {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
        <TouchableOpacity style={styles.addIconBtn} onPress={() => navigation.navigate('AddProperty')}>
          <Ionicons name="add" size={20} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Breadcrumb */}
      {view !== 'locations' && (
        <View style={styles.breadcrumb}>
          <Ionicons name="location-outline" size={13} color={colors.primary} />
          <Text style={styles.breadcrumbText} numberOfLines={1}>
            {selectedLocation}
            {(view === 'types' || view === 'configs' || view === 'properties') && selectedType ? ` / ${selectedType}` : ''}
            {view === 'properties' && selectedConfig ? ` / ${selectedConfig}` : ''}
          </Text>
        </View>
      )}

      {/* Status filter tabs — only on properties view */}
      {view === 'properties' && (() => {
        const tabs = initFilter === 'available'
          ? [{ key: 'available' as StatusFilter, label: 'Available', color: colors.success, icon: 'checkmark-circle' as const }]
          : initFilter === 'sold'
          ? [{ key: 'sold' as StatusFilter, label: 'Sold / Rented', color: colors.warning, icon: 'home' as const }]
          : [
              { key: 'available' as StatusFilter, label: 'Available', color: colors.success, icon: 'checkmark-circle' as const },
              { key: 'sold' as StatusFilter, label: 'Sold / Rented', color: colors.warning, icon: 'home' as const },
              { key: 'all' as StatusFilter, label: 'All', color: colors.primary, icon: 'grid' as const },
            ];
        return (
          <View style={styles.tabBar}>
            {tabs.map((tab) => {
              const active = statusFilter === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, active && { borderBottomColor: tab.color, borderBottomWidth: 3, backgroundColor: tab.color + '12' }]}
                  onPress={() => setStatusFilter(tab.key)}
                  activeOpacity={0.75}
                >
                  <Ionicons name={tab.icon} size={13} color={active ? tab.color : colors.textLight} />
                  <Text style={[styles.tabText, active && { color: tab.color, fontWeight: '700' }]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      })()}

      {/* Intent filter tabs — Rent / Buy / All — only on properties view when Available tab active */}
      {view === 'properties' && statusFilter === 'available' && (
        <View style={styles.intentTabBar}>
          {([
            { key: 'all' as IntentFilter, label: 'All', icon: 'grid-outline' as const, color: colors.primary },
            { key: 'rent' as IntentFilter, label: 'Rent', icon: 'home-outline' as const, color: colors.warning },
            { key: 'buy' as IntentFilter, label: 'Buy', icon: 'key-outline' as const, color: colors.success },
          ]).map((tab) => {
            const active = intentFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.intentTab, active && { backgroundColor: tab.color + '15', borderColor: tab.color }]}
                onPress={() => setIntentFilter(tab.key)}
                activeOpacity={0.75}
              >
                <Ionicons name={tab.icon} size={14} color={active ? tab.color : colors.textSecondary} />
                <Text style={[styles.intentTabText, active && { color: tab.color, fontWeight: '700' }]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Search bar */}
      <SearchBar value={search} onChange={setSearch} placeholder={searchPlaceholder} />

      {/* Result count */}
      {q.length > 0 && (
        <View style={styles.resultCount}>
          <Text style={styles.resultCountText}>
            {view === 'locations' ? filteredLocations.length
              : view === 'types' ? filteredTypes.length
              : filteredProperties.length} result(s) for "{search}"
          </Text>
        </View>
      )}

      {/* Locations */}
      {view === 'locations' && (
        <FlatList
          data={filteredLocations}
          keyExtractor={(l) => l._id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.locationCard} onPress={() => selectLocation(item._id)}>
              <View style={styles.locationIcon}>
                <Ionicons name="location-outline" size={22} color={colors.primary} />
              </View>
              <HL text={item._id} query={search} style={styles.locationName} />
              {statusFilter === 'available' ? (
                <View style={[styles.dotBadge, { backgroundColor: colors.success + '18' }]}>
                  <View style={[styles.dot, { backgroundColor: colors.success }]} />
                  <Text style={[styles.dotCount, { color: colors.success }]}>{item.available} Available</Text>
                </View>
              ) : statusFilter === 'sold' ? (
                <View style={styles.dotBadgeGroup}>
                  <View style={[styles.dotBadge, { backgroundColor: colors.error + '12' }]}>
                    <View style={[styles.dot, { backgroundColor: colors.error }]} />
                    <Text style={[styles.dotCount, { color: colors.error }]}>{item.sold} Sold</Text>
                  </View>
                  <View style={[styles.dotBadge, { backgroundColor: colors.warning + '18' }]}>
                    <View style={[styles.dot, { backgroundColor: colors.warning }]} />
                    <Text style={[styles.dotCount, { color: colors.warning }]}>{item.rented ?? 0} Rented</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.dotBadgeGroup}>
                  <View style={[styles.dotBadge, { backgroundColor: colors.success + '18' }]}>
                    <View style={[styles.dot, { backgroundColor: colors.success }]} />
                    <Text style={[styles.dotCount, { color: colors.success }]}>{item.available} Avail</Text>
                  </View>
                  <View style={[styles.dotBadge, { backgroundColor: colors.error + '12' }]}>
                    <View style={[styles.dot, { backgroundColor: colors.error }]} />
                    <Text style={[styles.dotCount, { color: colors.error }]}>{item.sold} Sold</Text>
                  </View>
                  <View style={[styles.dotBadge, { backgroundColor: colors.warning + '18' }]}>
                    <View style={[styles.dot, { backgroundColor: colors.warning }]} />
                    <Text style={[styles.dotCount, { color: colors.warning }]}>{item.rented ?? 0} Rent</Text>
                  </View>
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="location-outline" size={48} color={colors.textLight} /><Text style={styles.emptyTitle}>{q ? 'No matches found' : 'No locations yet'}</Text><Text style={styles.emptySub}>{q ? `No locations matching "${search}"` : 'Add properties to see locations'}</Text></View>}
        />
      )}

      {/* Types */}
      {view === 'types' && (
        <FlatList
          data={filteredTypes}
          keyExtractor={(t) => t._id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.typeCard} onPress={() => selectType(item._id)}>
              <View style={styles.typeIconWrap}><Ionicons name="business-outline" size={22} color={colors.primary} /></View>
              <HL text={item._id} query={search} style={styles.typeName} />
              {statusFilter === 'available' ? (
                <View style={[styles.dotBadge, { backgroundColor: colors.success + '18' }]}>
                  <View style={[styles.dot, { backgroundColor: colors.success }]} />
                  <Text style={[styles.dotCount, { color: colors.success }]}>{item.available} Available</Text>
                </View>
              ) : statusFilter === 'sold' ? (
                <View style={styles.dotBadgeGroup}>
                  <View style={[styles.dotBadge, { backgroundColor: colors.error + '12' }]}>
                    <View style={[styles.dot, { backgroundColor: colors.error }]} />
                    <Text style={[styles.dotCount, { color: colors.error }]}>{item.sold} Sold</Text>
                  </View>
                  <View style={[styles.dotBadge, { backgroundColor: colors.warning + '18' }]}>
                    <View style={[styles.dot, { backgroundColor: colors.warning }]} />
                    <Text style={[styles.dotCount, { color: colors.warning }]}>{item.rented ?? 0} Rented</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.dotBadgeGroup}>
                  <View style={[styles.dotBadge, { backgroundColor: colors.success + '18' }]}>
                    <View style={[styles.dot, { backgroundColor: colors.success }]} />
                    <Text style={[styles.dotCount, { color: colors.success }]}>{item.available} Avail</Text>
                  </View>
                  <View style={[styles.dotBadge, { backgroundColor: colors.error + '12' }]}>
                    <View style={[styles.dot, { backgroundColor: colors.error }]} />
                    <Text style={[styles.dotCount, { color: colors.error }]}>{item.sold} Sold</Text>
                  </View>
                  <View style={[styles.dotBadge, { backgroundColor: colors.warning + '18' }]}>
                    <View style={[styles.dot, { backgroundColor: colors.warning }]} />
                    <Text style={[styles.dotCount, { color: colors.warning }]}>{item.rented ?? 0} Rent</Text>
                  </View>
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="business-outline" size={48} color={colors.textLight} /><Text style={styles.emptyTitle}>{q ? 'No matches' : 'No types'}</Text></View>}
        />
      )}

      {/* BHK Config picker — only for Flat */}
      {view === 'configs' && (
        <ScrollView contentContainerStyle={styles.listContent}>
          <View style={styles.configPickerSection}>
            <View style={styles.configPickerHeader}>
              <Ionicons name="grid-outline" size={20} color={colors.primary} />
              <Text style={styles.configPickerTitle}>Select Configuration</Text>
            </View>
            <Text style={styles.configPickerSub}>Choose BHK type to see matching properties</Text>
            <View style={styles.configChipGrid}>
              {FLAT_CONFIGS.filter((c) => !q || c.toLowerCase().includes(q)).map((config) => {
                const rentCount = properties.filter(
                  (p) => p.flatConfig === config && p.intent === 'rent' && p.status === 'available'
                ).length;
                const buyCount = properties.filter(
                  (p) => p.flatConfig === config && p.intent === 'buy' && p.status === 'available'
                ).length;
                const totalCount = properties.filter((p) => p.flatConfig === config).length;
                const hasAny = totalCount > 0;
                return (
                  <TouchableOpacity
                    key={config}
                    style={[styles.configChip, !hasAny && { opacity: 0.5 }]}
                    onPress={() => selectConfig(config)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={styles.configChipText}>{config}</Text>
                      {isLoading ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : hasAny ? (
                        <View style={styles.configCountRow}>
                          {rentCount > 0 && (
                            <View style={[styles.configCountBadge, { backgroundColor: colors.warning + '20' }]}>
                              <Ionicons name="home-outline" size={11} color={colors.warning} />
                              <Text style={[styles.configCountText, { color: colors.warning }]}>{rentCount} Rent</Text>
                            </View>
                          )}
                          {buyCount > 0 && (
                            <View style={[styles.configCountBadge, { backgroundColor: colors.success + '20' }]}>
                              <Ionicons name="key-outline" size={11} color={colors.success} />
                              <Text style={[styles.configCountText, { color: colors.success }]}>{buyCount} Buy</Text>
                            </View>
                          )}
                          {rentCount === 0 && buyCount === 0 && (
                            <Text style={styles.configCountNone}>No available</Text>
                          )}
                        </View>
                      ) : (
                        <Text style={styles.configCountNone}>No properties</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>
      )}

      {/* Properties */}
      {view === 'properties' && (
        isLoading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} /> : (
          statusFilter === 'sold' ? (
            // ── Sold / Rented: separate tabs ─────────────────────────────────
            <>
              {/* Sub-tab bar: Sold | Rented */}
              {(() => {
                const soldCount = filteredProperties.filter((p) => p.status === 'sold').length;
                const rentedCount = filteredProperties.filter((p) => p.status === 'rented').length;
                return (
                  <View style={styles.soldSubTabBar}>
                    <TouchableOpacity
                      style={[styles.soldSubTab, soldSubTab === 'sold' && styles.soldSubTabActive]}
                      onPress={() => setSoldSubTab('sold')}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.soldSubDot, { backgroundColor: colors.error }]} />
                      <Text style={[styles.soldSubTabText, soldSubTab === 'sold' && { color: colors.error, fontWeight: '700' }]}>
                        Sold
                      </Text>
                      <View style={[styles.soldSubBadge, { backgroundColor: colors.error + (soldSubTab === 'sold' ? 'FF' : '30') }]}>
                        <Text style={[styles.soldSubBadgeText, { color: soldSubTab === 'sold' ? '#fff' : colors.error }]}>{soldCount}</Text>
                      </View>
                      {soldSubTab === 'sold' && <View style={[styles.soldSubIndicator, { backgroundColor: colors.error }]} />}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.soldSubTab, soldSubTab === 'rented' && styles.soldSubTabActiveRented]}
                      onPress={() => setSoldSubTab('rented')}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.soldSubDot, { backgroundColor: colors.warning }]} />
                      <Text style={[styles.soldSubTabText, soldSubTab === 'rented' && { color: colors.warning, fontWeight: '700' }]}>
                        Rented
                      </Text>
                      <View style={[styles.soldSubBadge, { backgroundColor: colors.warning + (soldSubTab === 'rented' ? 'FF' : '30') }]}>
                        <Text style={[styles.soldSubBadgeText, { color: soldSubTab === 'rented' ? '#fff' : colors.warning }]}>{rentedCount}</Text>
                      </View>
                      {soldSubTab === 'rented' && <View style={[styles.soldSubIndicator, { backgroundColor: colors.warning }]} />}
                    </TouchableOpacity>
                  </View>
                );
              })()}

              {/* Sold FlatList */}
              {soldSubTab === 'sold' && (() => {
                const soldProps = filteredProperties.filter((p) => p.status === 'sold');
                return (
                  <FlatList
                    data={soldProps}
                    keyExtractor={(p) => p._id}
                    contentContainerStyle={styles.listContent}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <PropertyCard
                        property={item}
                        query={search}
                        onStatusTap={() => { setSelectedProp(item); setStatusModal(true); }}
                        onWaTap={() => openWa(item)}
                        onDetailTap={() => navigation.navigate('PropertyDetail', { propertyId: item._id })}
                        onEditTap={() => navigation.navigate('AddProperty', { editId: item._id })}
                      />
                    )}
                    ListEmptyComponent={
                      <View style={styles.empty}>
                        <Ionicons name="close-circle-outline" size={48} color={colors.textLight} />
                        <Text style={styles.emptyTitle}>{q ? 'No matches' : 'No sold properties'}</Text>
                        <Text style={styles.emptySub}>{q ? `Nothing matches "${search}"` : 'Mark a property as Sold to see it here'}</Text>
                      </View>
                    }
                  />
                );
              })()}

              {/* Rented FlatList */}
              {soldSubTab === 'rented' && (() => {
                const rentedProps = filteredProperties.filter((p) => p.status === 'rented');
                return (
                  <FlatList
                    data={rentedProps}
                    keyExtractor={(p) => p._id}
                    contentContainerStyle={styles.listContent}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <PropertyCard
                        property={item}
                        query={search}
                        onStatusTap={() => { setSelectedProp(item); setStatusModal(true); }}
                        onWaTap={() => openWa(item)}
                        onDetailTap={() => navigation.navigate('PropertyDetail', { propertyId: item._id })}
                        onEditTap={() => navigation.navigate('AddProperty', { editId: item._id })}
                      />
                    )}
                    ListEmptyComponent={
                      <View style={styles.empty}>
                        <Ionicons name="home-outline" size={48} color={colors.textLight} />
                        <Text style={styles.emptyTitle}>{q ? 'No matches' : 'No rented properties'}</Text>
                        <Text style={styles.emptySub}>{q ? `Nothing matches "${search}"` : 'Mark a property as Rented to see it here'}</Text>
                      </View>
                    }
                  />
                );
              })()}
            </>
          ) : (
            // ── Available / All: flat list ────────────────────────────────────
            <FlatList
              data={filteredProperties}
              keyExtractor={(p) => p._id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <PropertyCard
                  property={item}
                  query={search}
                  onStatusTap={() => { setSelectedProp(item); setStatusModal(true); }}
                  onWaTap={() => openWa(item)}
                  onDetailTap={() => navigation.navigate('PropertyDetail', { propertyId: item._id })}
                  onEditTap={() => navigation.navigate('AddProperty', { editId: item._id })}
                />
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="home-outline" size={48} color={colors.textLight} />
                  <Text style={styles.emptyTitle}>{q ? 'No matches' : `No ${statusFilter === 'all' ? '' : statusFilter} properties`}</Text>
                  <Text style={styles.emptySub}>{q ? `Nothing matches "${search}"` : 'Try a different filter'}</Text>
                </View>
              }
            />
          )
        )
      )}

      <StatusModal visible={statusModal} property={selectedProp} onClose={() => setStatusModal(false)} onStatusChange={handleStatusChange} />
      <ExportModal visible={showExport} onClose={() => setShowExport(false)} />
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
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: typography.lg, fontWeight: typography.bold, color: colors.textPrimary, textAlign: 'center' },
  addIconBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  breadcrumb: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing.base, paddingVertical: spacing.xs + 2,
    backgroundColor: colors.primaryLight,
  },
  breadcrumbText: { fontSize: typography.xs, color: colors.primary, fontWeight: typography.semiBold, flex: 1 },

  // Status filter tabs — pill/underline hybrid
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingHorizontal: spacing.sm,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: spacing.sm + 2,
    borderBottomWidth: 3, borderBottomColor: 'transparent',
  },
  tabText: { fontSize: typography.xs, fontWeight: '600', color: colors.textSecondary },

  resultCount: { paddingHorizontal: spacing.base, paddingVertical: spacing.xs, marginTop: spacing.xs },
  resultCountText: { fontSize: typography.xs, color: colors.textSecondary, fontStyle: 'italic' },
  listContent: { padding: spacing.base, gap: spacing.sm, paddingBottom: spacing.xxxl },

  locationCard: {
    backgroundColor: colors.white, borderRadius: 16, padding: spacing.base,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    elevation: 1, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  locationIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  locationName: { flex: 1, fontSize: typography.base, fontWeight: typography.bold, color: colors.textPrimary },

  dotBadgeGroup: { flexDirection: 'column', gap: 3, alignItems: 'flex-end' },
  dotBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotCount: { fontSize: typography.xs, fontWeight: typography.bold },

  typeCard: {
    backgroundColor: colors.white, borderRadius: 14, padding: spacing.base,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    elevation: 1, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  typeIconWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  typeName: { flex: 1, fontSize: typography.base, fontWeight: typography.bold, color: colors.textPrimary },


  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionLabel: { fontSize: typography.sm, fontWeight: typography.bold, textTransform: 'uppercase', letterSpacing: 0.6, flex: 1 },
  sectionCount: { fontSize: typography.xs, color: colors.textSecondary, fontWeight: typography.semiBold },
  sectionEmpty: { fontSize: typography.sm, color: colors.textLight, fontStyle: 'italic', paddingVertical: spacing.sm, paddingHorizontal: 2 },

  // ── Rent/Buy intent tab bar ──────────────────────────────────────────────
  intentTabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  intentTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: spacing.sm,
    borderRadius: 10, borderWidth: 1.5, borderColor: colors.border,
  },
  intentTabText: { fontSize: typography.xs, fontWeight: '600', color: colors.textSecondary },

  // ── BHK config picker ────────────────────────────────────────────────────
  configPickerSection: {
    backgroundColor: colors.white, borderRadius: 16, padding: spacing.base,
    gap: spacing.sm, elevation: 1, shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  configPickerHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  configPickerTitle: { fontSize: typography.md, fontWeight: typography.bold, color: colors.textPrimary },
  configPickerSub: { fontSize: typography.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  configChipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  configChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.base, paddingVertical: spacing.md,
    backgroundColor: colors.primaryLight, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.primary + '40',
    minWidth: '45%', flex: 1,
  },
  configChipText: { fontSize: typography.md, fontWeight: typography.bold, color: colors.primary },
  configCountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  configCountBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  configCountText: { fontSize: typography.xs, fontWeight: typography.semiBold },
  configCountNone: { fontSize: typography.xs, color: colors.textLight, fontStyle: 'italic' },

  // ── Sold/Rented sub-tab bar ──────────────────────────────────────────────
  soldSubTabBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  soldSubTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12,
    position: 'relative',
  },
  soldSubTabActive: {
    backgroundColor: colors.error + '08',
  },
  soldSubTabActiveRented: {
    backgroundColor: colors.warning + '08',
  },
  soldSubDot: { width: 7, height: 7, borderRadius: 4 },
  soldSubTabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  soldSubBadge: {
    borderRadius: 10, minWidth: 20, paddingHorizontal: 6, paddingVertical: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  soldSubBadgeText: { fontSize: 11, fontWeight: '700' },
  soldSubIndicator: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3,
  },

  empty: { alignItems: 'center', paddingTop: 60, gap: spacing.sm },
  emptyTitle: { fontSize: typography.md, fontWeight: typography.bold, color: colors.textPrimary },
  emptySub: { fontSize: typography.sm, color: colors.textSecondary, textAlign: 'center' },
});
