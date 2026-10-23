import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, RefreshControl, SafeAreaView, ScrollView,
  StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import axiosInstance from '../../api/axiosInstance';

type PropertyRequest = {
  _id?: string;
  id?: string;
  requestId: string;
  sessionId?: string;
  location?: string;
  bhk?: string | number;
  budget?: string | number;
  price?: string | number;
  society?: string;
  status?: string;
  propertyType?: string;
  purpose?: string;
  notes?: string;
  createdAt?: string;
  [key: string]: any;
};
const BLUE = '#2157C9';

export default function PropertyRequestsScreen() {
  const navigation = useNavigation<any>();
  const [requests, setRequests] = useState<PropertyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [viewItem, setViewItem] = useState<PropertyRequest | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const loadRequests = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const response = await axiosInstance.get('/property-requests?status=pending');
      const payload = response.data;
      const rows = Array.isArray(payload) ? payload : (payload?.data ?? payload?.requests ?? payload?.items ?? []);
      if (!Array.isArray(rows)) throw new Error('Unexpected response from server');
      setRequests(rows.filter((r: PropertyRequest) => String(r.status ?? '').toLowerCase() === 'pending'));
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  // One tap on the tick completes and removes the request from this pending list.
  const quickComplete = async (item: PropertyRequest) => {
    const requestId = item.requestId;
    if (!requestId) {
      Toast.show({ type: 'error', text1: 'Request ID missing' });
      return;
    }
    if (completingId) return;
    setCompletingId(requestId);
    try {
      await axiosInstance.patch(`/property-requests/${encodeURIComponent(requestId)}/complete`);
      setRequests((cur) => cur.filter((r) => r.requestId !== requestId));
      if (viewItem?.requestId === requestId) setViewItem(null);
      Toast.show({ type: 'success', text1: 'Requirement completed ✓' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Could not complete', text2: e?.response?.data?.message || e?.message || 'Please retry.' });
    } finally {
      setCompletingId(null);
    }
  };

  const renderItem = ({ item }: { item: PropertyRequest }) => (
    <View style={styles.card}>
      <View style={styles.cardMain}>
        <View style={styles.cardTitleRow}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setViewItem(item)} activeOpacity={0.8}>
            <Text style={styles.society} numberOfLines={2}>{item.society || item.location || 'Property requirement'}</Text>
            <Text style={styles.location}><Ionicons name="location-outline" size={13} color="#64748B" /> {item.location || 'Location not specified'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.checkButton, completingId === item.requestId && { opacity: 0.6 }]}
            onPress={() => quickComplete(item)}
            disabled={!!completingId}
            accessibilityLabel="Mark requirement complete"
          >
            {completingId === item.requestId ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark" size={20} color="#fff" />}
          </TouchableOpacity>
        </View>
        <View style={styles.chips}>
          {!!item.bhk && <View style={styles.chip}><Text style={styles.chipText}>{String(item.bhk).toUpperCase()}</Text></View>}
          {!!(item.budget ?? item.price) && <View style={styles.chip}><Text style={styles.chipText}>₹ {item.budget ?? item.price}</Text></View>}
          {!!item.propertyType && <View style={styles.chip}><Text style={styles.chipText}>{item.propertyType}</Text></View>}
        </View>
        {!!item.notes && <Text style={styles.notes} numberOfLines={2}>{item.notes}</Text>}
        <View style={styles.cardFooter}>
          <Text style={styles.requestId}>{item.requestId ? `ID: ${item.requestId}` : 'Pending requirement'}</Text>
          <TouchableOpacity style={styles.viewHint} onPress={() => setViewItem(item)}><Text style={styles.viewHintText}>View details</Text><Ionicons name="chevron-forward" size={13} color={BLUE} /></TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const detailRows: [string, string][] = viewItem ? Object.entries(viewItem)
    .filter(([key, value]) => !['_id', 'id', '__v', 'sessionId', 'completedBy', 'completedAt'].includes(key) && value !== undefined && value !== null && String(value).trim() !== '')
    .map(([key, value]) => {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
      const formatted = key === 'createdAt' ? new Date(String(value)).toLocaleString() : Array.isArray(value) || (typeof value === 'object' && value !== null) ? JSON.stringify(value) : String(value);
      return [label, formatted];
    }) : [];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BLUE} />
      <LinearGradient colors={['#1947A9', '#2563EB']} style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={23} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerIcon}><Ionicons name="clipboard-outline" size={23} color="#fff" /></View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Property Requests</Text>
          <Text style={styles.headerSub}>Tap a requirement to read details</Text>
        </View>
        <View style={styles.count}><Text style={styles.countText}>{requests.length}</Text></View>
      </LinearGradient>

      <View style={styles.sectionHead}>
        <View><Text style={styles.sectionTitle}>Pending requirements</Text><Text style={styles.sectionSub}>Open to read · tick to remove from pending</Text></View>
        <TouchableOpacity style={styles.refresh} onPress={() => loadRequests(true)}><Ionicons name="refresh" size={20} color={BLUE} /></TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={BLUE} /><Text style={styles.muted}>Loading requests…</Text></View>
      ) : error ? (
        <View style={styles.center}><View style={styles.emptyIcon}><Ionicons name="cloud-offline-outline" size={32} color="#DC2626" /></View><Text style={styles.emptyTitle}>Could not load requests</Text><Text style={styles.muted}>{error}</Text><TouchableOpacity style={styles.retry} onPress={() => loadRequests()}><Ionicons name="refresh" size={17} color="#fff" /><Text style={styles.retryText}>Try again</Text></TouchableOpacity></View>
      ) : requests.length === 0 ? (
        <View style={styles.center}><View style={styles.emptyIcon}><Ionicons name="checkmark-done-circle-outline" size={34} color="#16A34A" /></View><Text style={styles.emptyTitle}>All caught up!</Text><Text style={styles.muted}>No pending property requests.</Text><TouchableOpacity style={styles.retry} onPress={() => loadRequests()}><Ionicons name="refresh" size={17} color="#fff" /><Text style={styles.retryText}>Refresh</Text></TouchableOpacity></View>
      ) : (
        <FlatList data={requests} keyExtractor={(item, index) => item.requestId || item._id || item.id || String(index)} renderItem={renderItem} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadRequests(true)} tintColor={BLUE} />} />
      )}

      <Modal visible={!!viewItem} transparent animationType="slide" onRequestClose={() => setViewItem(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.detailSheet}>
            <View style={styles.detailHeader}>
              <View style={{ flex: 1 }}><Text style={styles.detailTitle}>Requirement details</Text><Text style={styles.detailSubtitle}>Read-only view</Text></View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setViewItem(null)}><Ionicons name="close" size={22} color="#475569" /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.detailBody}>
              {detailRows.map(([label, value]) => <View key={label} style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{String(value)}</Text></View>)}
            </ScrollView>
            {viewItem && <TouchableOpacity style={styles.completeFull} onPress={() => quickComplete(viewItem)} disabled={!!completingId}>
              {completingId === viewItem.requestId ? <ActivityIndicator color="#fff" /> : <><Ionicons name="checkmark-circle-outline" size={19} color="#fff" /><Text style={styles.completeFullText}>Mark complete</Text></>}
            </TouchableOpacity>}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2F5FA' },
  header: { minHeight: 76, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  back: { padding: 4 }, headerIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 }, headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' }, headerSub: { color: '#DCE8FF', fontSize: 11, marginTop: 3 },
  count: { backgroundColor: '#fff', minWidth: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }, countText: { color: BLUE, fontWeight: '800' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 }, sectionTitle: { fontSize: 17, fontWeight: '800', color: '#111827' }, sectionSub: { fontSize: 12, color: '#64748B', marginTop: 5 },
  refresh: { backgroundColor: '#E3ECFF', width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, list: { paddingHorizontal: 14, paddingBottom: 32 },
  card: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 11, borderWidth: 1, borderColor: '#E5EAF2', elevation: 2, shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }, cardMain: { padding: 15 }, cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  society: { color: '#111827', fontSize: 16, fontWeight: '800', paddingTop: 5 }, location: { color: '#64748B', fontSize: 13, marginTop: 6 }, checkButton: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 }, chip: { backgroundColor: '#EEF4FF', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 }, chipText: { color: '#1D4ED8', fontSize: 12, fontWeight: '700' }, notes: { color: '#475569', fontSize: 12, marginTop: 8, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }, requestId: { color: '#94A3B8', fontSize: 10 }, viewHint: { flexDirection: 'row', alignItems: 'center', gap: 2 }, viewHintText: { color: BLUE, fontSize: 12, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 70 }, emptyIcon: { width: 66, height: 66, borderRadius: 20, backgroundColor: '#E6F8ED', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }, emptyTitle: { fontSize: 17, fontWeight: '800', color: '#111827', textAlign: 'center' }, muted: { color: '#64748B', fontSize: 13, textAlign: 'center', marginTop: 9, lineHeight: 20 }, retry: { marginTop: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1D4ED8', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 }, retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' }, detailSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingBottom: 26 }, detailHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#EEF2F7' }, detailTitle: { color: '#111827', fontSize: 18, fontWeight: '800' }, detailSubtitle: { color: '#64748B', fontSize: 12, marginTop: 3 }, closeBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }, detailBody: { paddingHorizontal: 20, paddingVertical: 8 }, detailRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }, detailLabel: { color: '#64748B', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }, detailValue: { color: '#111827', fontSize: 15, marginTop: 5 }, completeFull: { marginHorizontal: 20, marginTop: 12, backgroundColor: '#16A34A', borderRadius: 13, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }, completeFullText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
