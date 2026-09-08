import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Image, Modal, Pressable, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import { usePropertyStore } from '../../../store/propertyStore';
import axiosInstance from '../../../api/axiosInstance';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';

// ─── Export CSV Modal ─────────────────────────────────────────────────────────
// ─── Price display helper ─────────────────────────────────────────────────────
function formatPrice(raw: string | undefined): string {
  if (!raw) return '';
  if (raw.includes('(')) return raw;
  const num = parseFloat(raw.replace(/,/g, ''));
  if (isNaN(num) || num === 0) return raw;
  let short = '';
  if (num >= 10_000_000) short = `${(num / 10_000_000).toFixed(2).replace(/\.?0+$/, '')} Cr`;
  else if (num >= 100_000) short = `${(num / 100_000).toFixed(2).replace(/\.?0+$/, '')} L`;
  else if (num >= 1_000) short = `${(num / 1_000).toFixed(1).replace(/\.?0+$/, '')}k`;
  return short ? `${raw} (${short})` : raw;
}

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

function StatCard({
  icon, label, value, bg, iconColor, onPress,
}: {
  icon: string; label: string; value: number;
  bg: string; iconColor: string; onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.statCard, { backgroundColor: bg }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
    >
      <View style={[styles.statIcon, { backgroundColor: iconColor + '20' }]}>
        <Ionicons name={icon as any} size={22} color={iconColor} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function PropertiesDashboardScreen() {
  const navigation = useNavigation<any>();
  const { stats, fetchStats, properties, fetchProperties } = usePropertyStore();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recentProps, setRecentProps] = useState<any[]>([]);
  const [showExport, setShowExport] = useState(false);

  const load = useCallback(async () => {
    await fetchStats();
    // Fetch recent properties (all, sorted by newest)
    try {
      await fetchProperties({});
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Get top 3 most recently added properties
  const recent = [...(properties || [])]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 3);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    await fetchProperties({});
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Properties</Text>
          <Text style={styles.headerSub}>Inventory Overview</Text>
        </View>
        <TouchableOpacity style={styles.exportBtn} onPress={() => setShowExport(true)}>
          <Ionicons name="download-outline" size={15} color="#059669" />
          <Text style={styles.exportBtnText}>CSV</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <Text style={styles.sectionTitle}>OVERVIEW</Text>
            <View style={styles.statsRow}>
              <StatCard
                icon="home-outline" label="Total" value={stats.total}
                bg={colors.white} iconColor={colors.primary}
                onPress={() => navigation.navigate('ExploreProperties', { filterStatus: 'all' })}
              />
              <StatCard
                icon="checkmark-circle-outline" label="Available" value={stats.available}
                bg={colors.white} iconColor={colors.success}
                onPress={() => navigation.navigate('ExploreProperties', { filterStatus: 'available' })}
              />
              <StatCard
                icon="archive-outline" label="Sold/Rented" value={stats.sold}
                bg={colors.white} iconColor={colors.warning}
                onPress={() => navigation.navigate('ExploreProperties', { filterStatus: 'sold' })}
              />
            </View>

            <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
            <TouchableOpacity style={styles.addPropertyFull} onPress={() => navigation.navigate('AddProperty')}>
              <View style={[styles.actionIcon, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="add-circle-outline" size={26} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Add Property</Text>
                <Text style={styles.actionSub}>List a new property to inventory</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
            </TouchableOpacity>

            {/* ── RECENT UPLOADS ── */}
            {recent.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>RECENT UPLOADS</Text>
                <View style={styles.recentList}>
                  {recent.map((prop) => {
                    const statusColor = prop.status === 'available' ? colors.success : prop.status === 'sold' ? colors.error : colors.warning;
                    return (
                      <TouchableOpacity
                        key={prop._id}
                        style={styles.recentCard}
                        onPress={() => navigation.navigate('PropertyDetail', { propertyId: prop._id })}
                        activeOpacity={0.82}
                      >
                        {prop.photos?.length > 0 ? (
                          <Image source={{ uri: prop.photos[0] }} style={styles.recentThumb} />
                        ) : (
                          <View style={[styles.recentThumb, styles.recentThumbPlaceholder]}>
                            <Ionicons name="image-outline" size={22} color={colors.textLight} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recentName} numberOfLines={1}>{prop.projectName}</Text>
                          <Text style={styles.recentMeta} numberOfLines={1}>{prop.propertyType} · {prop.location}</Text>
                          {prop.price ? <Text style={styles.recentPrice}>₹ {formatPrice(prop.price)}</Text> : null}
                        </View>
                        <View style={[styles.recentBadge, { backgroundColor: statusColor + '18' }]}>
                          <Text style={[styles.recentBadgeText, { color: statusColor }]}>
                            {prop.status === 'available' ? 'Avail' : prop.status === 'sold' ? 'Sold' : 'Rented'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
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
  headerTitle: { fontSize: typography.xl, fontWeight: typography.bold, color: colors.textPrimary },
  headerSub: { fontSize: typography.xs, color: colors.textSecondary, marginTop: 1 },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#059669' + '15', borderRadius: 10,
    paddingHorizontal: spacing.sm + 2, paddingVertical: 7,
  },
  exportBtnText: { fontSize: typography.xs, fontWeight: typography.bold, color: '#059669' },
  content: { padding: spacing.base, gap: spacing.md, paddingBottom: spacing.xxxl },

  sectionTitle: {
    fontSize: typography.xs, fontWeight: typography.bold,
    color: colors.textSecondary, letterSpacing: 0.8,
    textTransform: 'uppercase', marginTop: spacing.xs,
  },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1, borderRadius: 16, padding: spacing.md, alignItems: 'center', gap: spacing.xs,
    elevation: 1, shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },
  statIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontSize: typography.xxl, fontWeight: typography.bold, color: colors.textPrimary },
  statLabel: { fontSize: typography.xs, color: colors.textSecondary, textAlign: 'center' },

  addPropertyFull: {
    backgroundColor: colors.white, borderRadius: 16, padding: spacing.base,
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    elevation: 1, shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },
  actionIcon: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  actionTitle: { fontSize: typography.base, fontWeight: typography.bold, color: colors.textPrimary },
  actionSub: { fontSize: typography.xs, color: colors.textSecondary, marginTop: 2 },

  // Recent
  recentList: { gap: spacing.sm },
  recentCard: {
    backgroundColor: colors.white, borderRadius: 14, padding: spacing.sm + 2,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    elevation: 1, shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },
  recentThumb: { width: 58, height: 58, borderRadius: 10 },
  recentThumbPlaceholder: { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  recentName: { fontSize: typography.base, fontWeight: typography.bold, color: colors.textPrimary },
  recentMeta: { fontSize: typography.xs, color: colors.textSecondary, marginTop: 2 },
  recentPrice: { fontSize: typography.sm, fontWeight: typography.semiBold, color: colors.primary, marginTop: 2 },
  recentBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  recentBadgeText: { fontSize: typography.xs, fontWeight: typography.bold },
});
