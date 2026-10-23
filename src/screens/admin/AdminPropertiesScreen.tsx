import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, Share, Linking, RefreshControl, Platform,
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
import * as DocumentPicker from 'expo-document-picker';
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
  const [importing, setImporting] = React.useState(false);
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
      // Browser download (this app is commonly used on web)
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'properties.csv';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      } else {
        const path = FileSystem.documentDirectory + 'properties.csv';
        await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
        await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export Properties CSV' });
      }
    } catch (e: any) {
      Alert.alert('Export Failed', e?.response?.data?.message || e.message || 'Could not export properties.');
    } finally {
      setExporting(false);
    }
  };

  const handleImportCSV = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'application/octet-stream'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets?.length) return;
      const asset: any = picked.assets[0];
      setImporting(true);
      const form = new FormData();
      if (Platform.OS === 'web' && asset.file) {
        form.append('file', asset.file, asset.name || 'properties.csv');
      } else {
        form.append('file', {
          uri: asset.uri,
          name: asset.name || 'properties.csv',
          type: asset.mimeType || 'text/csv',
        } as any);
      }
      const response = await axiosInstance.post('/property-crm/import', form, {
        headers: { 'Content-Type': undefined as any },
      });
      await load();
      const summary = response.data?.summary;
      const imported = summary?.imported ?? 0;
      const skipped = summary?.skipped ?? 0;
      const errors = Array.isArray(summary?.errors) ? summary.errors.slice(0, 5).map((e: any) => `Row ${e.row}: ${e.reason}`).join('\n') : '';
      Alert.alert(
        'Import complete',
        `${imported} properties imported. ${skipped} skipped.${errors ? `\n\n${errors}` : ''}${summary?.errors?.length > 5 ? `\n…and ${summary.errors.length - 5} more errors.` : ''}`,
      );
    } catch (e: any) {
      Alert.alert('Import Failed', e?.response?.data?.message || e.message || 'Could not import CSV.');
    } finally {
      setImporting(false);
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
  importBtn:       { width: 38, height: 38, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.primaryLight, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  exportBtn:       { width: 38, height: 38, borderWidth: 1.5, borderColor: colors.primary, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
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
