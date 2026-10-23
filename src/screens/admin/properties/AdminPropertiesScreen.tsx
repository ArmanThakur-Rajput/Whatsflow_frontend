import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, Share, Linking, RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { usePropertyStore, Property } from '../../../store/propertyStore';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  available: { bg: '#ECFDF5', text: '#059669', label: 'Available' },
  sold:      { bg: '#FEF2F2', text: '#EF4444', label: 'Sold' },
  rented:    { bg: '#FEF9E7', text: '#D97706', label: 'Rented' },
};

const TYPE_ICONS: Record<string, string> = {
  Flat: 'home', Shop: 'storefront', Plot: 'map',
};

// ── Format price ──────────────────────────────────────────────────────────────
function formatPrice(raw: string) {
  if (!raw) return '—';
  const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
  if (isNaN(n)) return raw;
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

// ── WhatsApp draft ────────────────────────────────────────────────────────────
function buildWhatsAppDraft(p: Property): string {
  const lines: string[] = [];
  lines.push(`🏠 *${p.projectName}*`);
  lines.push(`📍 ${p.location}`);
  lines.push(`🏷️ Type: ${p.propertyType}${p.flatConfig ? ` | ${p.flatConfig}` : ''}`);
  lines.push(`💰 Price: ${formatPrice(p.price)}`);
  if (p.floor)        lines.push(`🏢 Floor: ${p.floor}`);
  if (p.carpetArea)   lines.push(`📐 Carpet Area: ${p.carpetArea}`);
  if (p.buildupArea)  lines.push(`📐 Buildup Area: ${p.buildupArea}`);
  lines.push(`✅ Sanction: ${p.sanction}`);
  lines.push(`🚗 Parking: ${p.parking}`);
  lines.push(`💧 Water: ${p.water}`);
  if (p.lift)         lines.push(`🛗 Lift: ${p.lift}`);
  if (p.facing)       lines.push(`🧭 Facing: ${p.facing}`);
  if (p.amenities?.length) lines.push(`✨ Amenities: ${p.amenities.join(', ')}`);
  if (p.gmapsLink)    lines.push(`📌 Map: ${p.gmapsLink}`);
  lines.push('');
  lines.push('_For more details, contact us._');
  return lines.join('\n');
}

// ── Property Card ─────────────────────────────────────────────────────────────
const PropertyCard = ({
  item, onEdit, onWhatsApp, onDelete,
}: {
  item: Property;
  onEdit: () => void;
  onWhatsApp: () => void;
  onDelete: () => void;
}) => {
  const st = STATUS_COLORS[item.status] || STATUS_COLORS.available;
  const icon = TYPE_ICONS[item.propertyType] || 'business';
  return (
    <View style={styles.card}>
      {/* Header row */}
      <View style={styles.cardHeader}>
        <View style={styles.cardIconWrap}>
          <Ionicons name={icon as any} size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.projectName}</Text>
          <Text style={styles.cardSub} numberOfLines={1}>
            <Ionicons name="location-outline" size={11} /> {item.location}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
          <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
        </View>
      </View>

      {/* Key info chips */}
      <View style={styles.chipRow}>
        <Chip icon="cash-outline" label={formatPrice(item.price)} />
        <Chip icon="layers-outline" label={item.propertyType} />
        <Chip icon="business-outline" label={`Floor ${item.floor}`} />
        {item.parking !== 'None' && <Chip icon="car-outline" label={item.parking} />}
      </View>

      <View style={styles.chipRow}>
        {item.carpetArea  && <Chip icon="resize-outline" label={`Carpet: ${item.carpetArea}`} />}
        {item.buildupArea && <Chip icon="resize-outline" label={`Buildup: ${item.buildupArea}`} />}
        <Chip icon="checkmark-circle-outline" label={`Sanction: ${item.sanction}`} />
        <Chip icon="water-outline" label={item.water} />
      </View>

      {/* Action row */}
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onEdit}>
          <Ionicons name="create-outline" size={16} color={colors.primary} />
          <Text style={[styles.actionLabel, { color: colors.primary }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onWhatsApp}>
          <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
          <Text style={[styles.actionLabel, { color: '#25D366' }]}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onDelete}>
          <Ionicons name="trash-outline" size={16} color="#EF4444" />
          <Text style={[styles.actionLabel, { color: '#EF4444' }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const Chip = ({ icon, label }: { icon: string; label: string }) => (
  <View style={styles.chip}>
    <Ionicons name={icon as any} size={11} color={colors.textSecondary} />
    <Text style={styles.chipText}>{label}</Text>
  </View>
);

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function AdminPropertiesScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { properties, stats, isLoading, fetchProperties, fetchStats, deleteProperty, exportCSV } = usePropertyStore();

  const [search, setSearch] = React.useState('');
  const [filterType, setFilterType] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState('');
  const [refreshing, setRefreshing] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  const load = React.useCallback(() => {
    const f: Record<string, string> = {};
    if (filterType)   f.propertyType = filterType;
    if (filterStatus) f.status       = filterStatus;
    fetchProperties(f);
    fetchStats();
  }, [filterType, filterStatus]);

  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Search filter (client-side)
  const filtered = React.useMemo(() => {
    if (!search.trim()) return properties;
    const q = search.toLowerCase();
    return properties.filter(
      (p) =>
        p.projectName.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.propertyType.toLowerCase().includes(q)
    );
  }, [properties, search]);

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Property', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteProperty(id) },
    ]);
  };

  const handleWhatsApp = (item: Property) => {
    const draft = buildWhatsAppDraft(item);
    const url = `whatsapp://send?text=${encodeURIComponent(draft)}`;
    Linking.canOpenURL(url).then((ok) => {
      if (ok) Linking.openURL(url);
      else Share.share({ message: draft });
    });
  };

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const f: Record<string, string> = {};
      if (filterType)   f.propertyType = filterType;
      if (filterStatus) f.status       = filterStatus;
      const csv = await exportCSV(f);
      const path = FileSystem.documentDirectory + 'properties.csv';
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export Properties CSV' });
    } catch (e: any) {
      Alert.alert('Export Failed', e.message);
    } finally {
      setExporting(false);
    }
  };

  const TYPE_FILTERS = ['', 'Flat', 'Shop', 'Plot'];
  const STATUS_FILTERS = ['', 'available', 'sold', 'rented'];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Properties</Text>
          <Text style={styles.headerSub}>{stats.total} total · {stats.available} available</Text>
        </View>
        <View style={styles.headerBtns}>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('AddProperty')}
          >
            <Ionicons name="add" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Search ── */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={colors.textSecondary} style={{ marginLeft: spacing.sm }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, location, type…"
          placeholderTextColor={colors.textLight}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} style={{ marginRight: spacing.sm }}>
            <Ionicons name="close-circle" size={16} color={colors.textLight} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ── Filters ── */}
      <View style={styles.filterRow}>
        {/* Type filter */}
        {TYPE_FILTERS.map((t) => (
          <TouchableOpacity
            key={t || 'all-type'}
            style={[styles.filterChip, filterType === t && styles.filterChipActive]}
            onPress={() => setFilterType(t)}
          >
            <Text style={[styles.filterChipText, filterType === t && styles.filterChipTextActive]}>
              {t || 'All Types'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((s) => (
          <TouchableOpacity
            key={s || 'all-status'}
            style={[styles.filterChip, filterStatus === s && styles.filterChipActive]}
            onPress={() => setFilterStatus(s)}
          >
            <Text style={[styles.filterChipText, filterStatus === s && styles.filterChipTextActive]}>
              {s ? STATUS_COLORS[s]?.label : 'All Status'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── List ── */}
      {isLoading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: spacing.base, paddingBottom: insets.bottom + 90 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="business-outline" size={52} color={colors.textLight} />
              <Text style={styles.emptyText}>No properties found</Text>
            </View>
          }
          renderItem={({ item }) => (
            <PropertyCard
              item={item}
              onEdit={() => navigation.navigate('AddProperty', { property: item })}
              onWhatsApp={() => handleWhatsApp(item)}
              onDelete={() => handleDelete(item._id, item.projectName)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.background },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.base, paddingTop: spacing.base, paddingBottom: spacing.sm },
  headerTitle:     { fontSize: typography.xl, fontWeight: typography.bold, color: colors.textPrimary },
  headerSub:       { fontSize: typography.xs, color: colors.textSecondary, marginTop: 2 },
  headerBtns:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exportBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: colors.primary, borderRadius: 10, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  exportLabel:     { fontSize: typography.xs, color: colors.primary, fontWeight: typography.semiBold },
  addBtn:          { backgroundColor: colors.primary, width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  searchWrap:      { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, marginHorizontal: spacing.base, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  searchInput:     { flex: 1, paddingVertical: 10, paddingHorizontal: spacing.sm, fontSize: typography.sm, color: colors.textPrimary },
  filterRow:       { flexDirection: 'row', paddingHorizontal: spacing.base, gap: spacing.xs, marginBottom: spacing.xs },
  filterChip:      { paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  filterChipActive:{ backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText:  { fontSize: typography.xs, color: colors.textSecondary },
  filterChipTextActive: { color: colors.white, fontWeight: typography.semiBold },
  card:            { backgroundColor: colors.white, borderRadius: 16, padding: spacing.base, marginBottom: spacing.md, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, borderWidth: 1, borderColor: '#F0F0F0' },
  cardHeader:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  cardIconWrap:    { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  cardTitle:       { fontSize: typography.base, fontWeight: typography.bold, color: colors.textPrimary },
  cardSub:         { fontSize: typography.xs, color: colors.textSecondary, marginTop: 2 },
  statusPill:      { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 10 },
  statusText:      { fontSize: typography.xs, fontWeight: typography.semiBold },
  chipRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  chip:            { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F5F5F5', paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 8 },
  chipText:        { fontSize: 10, color: colors.textSecondary },
  cardActions:     { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F0F0F0', marginTop: spacing.sm, paddingTop: spacing.sm, gap: spacing.sm },
  actionBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  actionLabel:     { fontSize: typography.xs, fontWeight: typography.semiBold },
  centered:        { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60, gap: spacing.md },
  emptyText:       { fontSize: typography.base, color: colors.textSecondary },
});
