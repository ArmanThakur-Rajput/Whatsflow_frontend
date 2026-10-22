import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';
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
  createdAt?: string;
};

const BLUE = '#2157C9';

export default function PropertyRequestsScreen() {
  const navigation = useNavigation<any>();
  const [requests, setRequests] = useState<PropertyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadRequests = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      // This endpoint must be implemented by the app backend and read MongoDB request_notif.
      const response = await axiosInstance.get('/property-requests');
      const payload = response.data;
      const rows = Array.isArray(payload) ? payload : (payload?.requests ?? payload?.data ?? payload?.items ?? []);
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

  const completeRequest = (item: PropertyRequest) => {
    if (!item.requestId) {
      Toast.show({ type: 'error', text1: 'Request ID missing', text2: 'This request cannot be safely updated.' });
      return;
    }
    Alert.alert('Mark as complete?', 'This request will be removed from the pending list.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Complete', onPress: async () => {
        setUpdatingId(item.requestId);
        try {
          await axiosInstance.patch(`/property-requests/${encodeURIComponent(item.requestId)}/complete`);
          setRequests(current => current.filter(r => r.requestId !== item.requestId));
          Toast.show({ type: 'success', text1: 'Request completed' });
        } catch (e: any) {
          Toast.show({ type: 'error', text1: 'Could not update request', text2: e?.response?.data?.message || e?.message || 'Please try again.' });
        } finally {
          setUpdatingId(null);
        }
      } },
    ]);
  };

  const renderItem = ({ item }: { item: PropertyRequest }) => (
    <View style={styles.card}>
      <View style={styles.cardMain}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.society} numberOfLines={2}>{item.society || item.location || 'Property requirement'}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Mark request complete" style={styles.checkButton} disabled={updatingId === item.requestId} onPress={() => completeRequest(item)}>
            {updatingId === item.requestId ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="checkmark" size={22} color="#fff" />}
          </TouchableOpacity>
        </View>
        <Text style={styles.location}><Ionicons name="location-outline" size={14} color="#64748B" /> {item.location || 'Location not specified'}</Text>
        <View style={styles.chips}>
          {!!item.bhk && <View style={styles.chip}><Text style={styles.chipText}>{item.bhk} BHK</Text></View>}
          {!!(item.budget ?? item.price) && <View style={styles.chip}><Text style={styles.chipText}>₹ {item.budget ?? item.price}</Text></View>}
          {!!item.propertyType && <View style={styles.chip}><Text style={styles.chipText}>{item.propertyType}</Text></View>}
        </View>
        <Text style={styles.requestId}>ID: {item.requestId}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BLUE} />
      <LinearGradient colors={['#1947A9', '#2563EB']} style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Go back"><Ionicons name="arrow-back" size={23} color="#fff" /></TouchableOpacity>
        <View style={styles.headerIcon}><Ionicons name="clipboard-outline" size={23} color="#fff" /></View>
        <View style={styles.headerText}><Text style={styles.headerTitle}>Property Requests</Text><Text style={styles.headerSub}>Pending requirements from MongoDB</Text></View>
        <View style={styles.count}><Text style={styles.countText}>{requests.length}</Text></View>
      </LinearGradient>
      <View style={styles.sectionHead}>
        <View><Text style={styles.sectionTitle}>Needs attention</Text><Text style={styles.sectionSub}>Tap the tick when a request is handled.</Text></View>
        <TouchableOpacity style={styles.refresh} onPress={() => loadRequests(true)} accessibilityLabel="Refresh requests"><Ionicons name="refresh" size={20} color={BLUE} /></TouchableOpacity>
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator size="large" color={BLUE} /><Text style={styles.muted}>Loading requests…</Text></View> : error ? (
        <View style={styles.center}><View style={styles.emptyIcon}><Ionicons name="cloud-offline-outline" size={32} color="#DC2626" /></View><Text style={styles.emptyTitle}>Could not load requests</Text><Text style={styles.muted}>{error}</Text><Text style={styles.hint}>Confirm the backend endpoints are deployed and reachable.</Text><TouchableOpacity style={styles.retry} onPress={() => loadRequests()}><Ionicons name="refresh" size={17} color="#fff" /><Text style={styles.retryText}>Try again</Text></TouchableOpacity></View>
      ) : requests.length === 0 ? (
        <View style={styles.center}><View style={styles.emptyIcon}><Ionicons name="checkmark-done-circle-outline" size={34} color="#16A34A" /></View><Text style={styles.emptyTitle}>All caught up!</Text><Text style={styles.muted}>No pending property requests.</Text><TouchableOpacity style={styles.retry} onPress={() => loadRequests()}><Ionicons name="refresh" size={17} color="#fff" /><Text style={styles.retryText}>Refresh</Text></TouchableOpacity></View>
      ) : <FlatList data={requests} keyExtractor={(item, index) => item.requestId || item._id || item.id || String(index)} renderItem={renderItem} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadRequests(true)} tintColor={BLUE} />} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2F5FA' },
  header: { minHeight: 76, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  back: { padding: 4 }, headerIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 }, headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' }, headerSub: { color: '#DCE8FF', fontSize: 11, marginTop: 3 },
  count: { backgroundColor: '#fff', minWidth: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }, countText: { color: BLUE, fontWeight: '800' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 }, sectionTitle: { fontSize: 17, fontWeight: '800', color: '#111827' }, sectionSub: { fontSize: 12, color: '#64748B', marginTop: 5 }, refresh: { backgroundColor: '#E3ECFF', width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 14, paddingBottom: 24 }, card: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 11, borderWidth: 1, borderColor: '#E5EAF2', elevation: 2, shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }, cardMain: { padding: 15 }, cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, society: { flex: 1, color: '#111827', fontSize: 16, fontWeight: '800', paddingTop: 5 }, checkButton: { width: 39, height: 39, borderRadius: 13, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center' }, location: { color: '#64748B', fontSize: 13, marginTop: 9 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 }, chip: { backgroundColor: '#EEF4FF', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 }, chipText: { color: '#1D4ED8', fontSize: 12, fontWeight: '700' }, requestId: { color: '#94A3B8', fontSize: 10, marginTop: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 70 }, emptyIcon: { width: 66, height: 66, borderRadius: 20, backgroundColor: '#E6F8ED', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }, emptyTitle: { fontSize: 17, fontWeight: '800', color: '#111827', textAlign: 'center' }, muted: { color: '#64748B', fontSize: 13, textAlign: 'center', marginTop: 9, lineHeight: 20 }, hint: { color: '#64748B', fontSize: 12, textAlign: 'center', marginTop: 10, lineHeight: 18 }, retry: { marginTop: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1D4ED8', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 }, retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
