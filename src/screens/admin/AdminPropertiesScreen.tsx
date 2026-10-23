import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, Share, Linking, RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { usePropertyStore, Property } from '../../store/propertyStore';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import axiosInstance from '../../api/axiosInstance';

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  available: { bg: '#ECFDF5', text: '#059669', label: 'Available' },
  sold:      { bg: '#FEF2F2', text: '#EF4444', label: 'Sold' },
  rented:    { bg: '#FEF9E7', text: '#D97706', label: 'Rented' },
};

const TYPE_ICONS: Record<string, string> = {
  Flat: 'home', Shop: 'storefront', Plot: 'map',
};

function formatPrice(raw: string) {
  if (!raw) return '—';
  const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
  if (isNaN(n)) return raw;
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function buildWhatsAppDraft(p: Property): string {
  const lines: string[] = [
    '*KIN PROPERTY MANAGEMENT*',
    '_Your Property, Our Trust_',
    '━━━━━━━━━━━━━━━━━━',
    `🏠 *${p.projectName || (p as any).society || (p as any)["society/project"] || 'Property'}*`,
    `📍 Location: ${p.location || 'On request'}`,
    `🏷️ Property Type: ${p.propertyType || (p as any).flatConfig || '—'}`,
    `💰 Price: ${formatPrice(p.price || '')}`,
  ];
  const optional: Array<[string, any]> = [
    ['Floor', p.floor], ['Carpet Area', p.carpetArea], ['Built-up Area', p.buildupArea],
    ['Sanction', p.sanction], ['Parking', p.parking], ['Water', p.water],
    ['Building Area', p.buildingArea], ['Flats on Floor', p.flatsOnFloor],
    ['Lift', p.lift], ['Wings', p.wings], ['Facing', p.facing],
    ['Amenities', p.amenities?.length ? p.amenities.join(', ') : null],
    ['Address', p.address], ['Google Maps', p.gmapsLink], ['Notes', p.notes],
  ];
  optional.forEach(([label, value]) => { if (value !== undefined && value !== null && value !== '') lines.push(`${label}: ${Array.isArray(value) ? value.join(', ') : String(value)}`); });
  lines.push('━━━━━━━━━━━━━━━━━━', '*Kin Property Management*', '_Your Property, Our Trust_');
  return lines.join('\n');
}

const HighlightText = ({ text, query, style }: { text: string; query: string; style: any }) => {
  const value = String(text ?? '');
  const q = query.trim();
  if (!q || !value.toLowerCase().includes(q.toLowerCase())) return <Text style={style}>{value}</Text>;
  const index = value.toLowerCase().indexOf(q.toLowerCase());
  return (
    <Text style={style}>
      {value.slice(0, index)}
      <Text style={styles.matchHighlight}>{value.slice(index, index + q.length)}</Text>
      {value.slice(index + q.length)}
    </Text>
  );
};

const PropertyCard = ({
  item, onOpen, onEdit, onWhatsApp, onDelete, search,
}: {
  item: Property;
  onOpen: () => void;
  onEdit: () => void;
  onWhatsApp: () => void;
  onDelete: () => void;
  search: string;
}) => {
  const icon = TYPE_ICONS[item.propertyType] || 'business';
  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onOpen} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIconWrap}>
          <Ionicons name={icon as any} size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <HighlightText text={item.projectName} query={search} style={styles.cardTitle} />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <Ionicons name="location-outline" size={11} color={colors.textSecondary} />
            <HighlightText text={item.location} query={search} style={styles.cardSub} />
          </View>
        </View>
      </View>

      <View style={styles.chipRow}>
        <View style={styles.chip}><Ionicons name="cash-outline" size={11} color={colors.textSecondary} /><HighlightText text={formatPrice(item.price)} query={search} style={styles.chipText} /></View>
        <View style={styles.chip}><Ionicons name="layers-outline" size={11} color={colors.textSecondary} /><HighlightText text={`${item.propertyType}${item.flatConfig ? ` · ${item.flatConfig}` : ''}`} query={search} style={styles.chipText} /></View>
        {item.carpetArea ? <View style={styles.chip}><Ionicons name="resize-outline" size={11} color={colors.textSecondary} /><HighlightText text={`Carpet: ${item.carpetArea} sqft`} query={search} style={styles.chipText} /></View> : null}
      </View>

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
      <View style={styles.openHint}><Text style={styles.openHintText}>Tap to view details</Text><Ionicons name="chevron-forward" size={14} color={colors.textLight} /></View>
    </TouchableOpacity>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function AdminPropertiesScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { properties, stats, isLoading, fetchProperties, fetchStats, deleteProperty, exportCSV } = usePropertyStore();

  const [search, setSearch] = React.useState('');
  const [refreshing, setRefreshing] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [pendingCount, setPendingCount] = React.useState(0);

  const load = React.useCallback(() => {
    fetchProperties({});
    fetchStats();
  }, []);

  // Fetch pending request count for badge
  const loadPendingCount = React.useCallback(async () => {
    try {
      const res = await axiosInstance.get('/property-requests?status=pending');
      const data = res.data?.data ?? res.data;
      const rows = Array.isArray(data) ? data : (data?.data ?? []);
      setPendingCount(rows.length);
    } catch {
      // silent — badge just won't show
    }
  }, []);

  useFocusEffect(React.useCallback(() => {
    load();
    loadPendingCount();
  }, [load, loadPendingCount]));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), loadPendingCount()]);
    setRefreshing(false);
  };

  const filtered = React.useMemo(() => {
    if (!search.trim()) return properties;
    const q = search.toLowerCase();
    return properties.filter((p) => {
      const searchable = [
        p.projectName, p.location, p.propertyType, p.flatConfig, p.price, p.floor,
        p.carpetArea, p.buildupArea, p.buildingArea, p.plotArea, p.address, p.notes,
        p.ownerName, p.ownerPhone, p.tenantPhone, p.parking, p.water, p.sanction,
        p.status, p.intent, p.facing, p.wings, p.flatsOnFloor, p.gmapsLink,
        ...(p.amenities || []),
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(q);
    });
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
      const csv = await exportCSV({});
      const path = FileSystem.documentDirectory + 'properties.csv';
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export Properties CSV' });
    } catch (e: any) {
      Alert.alert('Export Failed', e.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Properties</Text>
          <Text style={styles.headerSub}>{stats.total} properties</Text>
        </View>
        <View style={styles.headerBtns}>
          {/* 🔔 Property Requests Icon with badge */}
          <TouchableOpacity
            style={styles.requestsBtn}
            onPress={() => navigation.navigate('PropertyRequests')}
            accessibilityLabel="Property Requests"
          >
            <Ionicons name="clipboard-outline" size={20} color={colors.primary} />
            {pendingCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingCount > 99 ? '99+' : pendingCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.exportBtn}
            onPress={handleExportCSV}
            disabled={exporting}
          >
            {exporting
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Ionicons name="download-outline" size={18} color={colors.primary} />}
            <Text style={styles.exportLabel}>CSV</Text>
          </TouchableOpacity>
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
              search={search}
              onOpen={() => navigation.navigate('PropertyDetail', { propertyId: item._id })}
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
  requestsBtn:     { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  badge:           { position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 18, height: 18, paddingHorizontal: 3, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.background },
  badgeText:       { color: '#fff', fontSize: 9, fontWeight: '800' },
  exportBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: colors.primary, borderRadius: 10, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  exportLabel:     { fontSize: typography.xs, color: colors.primary, fontWeight: typography.semiBold },
  addBtn:          { backgroundColor: colors.primary, width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  searchWrap:      { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, marginHorizontal: spacing.base, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  searchInput:     { flex: 1, paddingVertical: 10, paddingHorizontal: spacing.sm, fontSize: typography.sm, color: colors.textPrimary },
  card:            { backgroundColor: colors.white, borderRadius: 16, padding: spacing.base, marginBottom: spacing.md, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, borderWidth: 1, borderColor: '#F0F0F0' },
  cardHeader:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  cardIconWrap:    { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  cardTitle:       { fontSize: typography.base, fontWeight: typography.bold, color: colors.textPrimary },
  cardSub:         { fontSize: typography.xs, color: colors.textSecondary, marginTop: 2 },
  chipRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  chip:            { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F5F5F5', paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 8 },
  chipText:        { fontSize: 10, color: colors.textSecondary },
  cardActions:     { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F0F0F0', marginTop: spacing.sm, paddingTop: spacing.sm, gap: spacing.sm },
  actionBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  actionLabel:     { fontSize: typography.xs, fontWeight: typography.semiBold },
  matchHighlight:  { color: '#075FE4', textDecorationLine: 'underline', backgroundColor: '#E8F1FF', fontWeight: '700' },
  openHint:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 6 },
  openHintText:    { fontSize: 10, color: colors.textLight },
  centered:        { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60, gap: spacing.md },
  emptyText:       { fontSize: typography.base, color: colors.textSecondary },
});
