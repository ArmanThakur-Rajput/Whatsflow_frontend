import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl, SafeAreaView, StatusBar,
  StyleSheet, Text, TouchableOpacity, View, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

const WEBHOOK_SECRET_KEY = 'riva-secret-2024';
const REQUESTS_WEBHOOK_URL =
  process.env.EXPO_PUBLIC_PROPERTY_REQUESTS_WEBHOOK_URL ||
  'https://whatsapp-lead-n8n.ndna0p.easypanel.host/webhook/property-requests';
const COMPLETE_WEBHOOK_URL =
  process.env.EXPO_PUBLIC_PROPERTY_REQUEST_COMPLETE_WEBHOOK_URL ||
  'https://whatsapp-lead-n8n.ndna0p.easypanel.host/webhook/property-request-complete';

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
  createdAt?: string;
  [key: string]: any;
};

const BLUE = '#1746A2';
const BG = '#F3F6FB';

function display(value: unknown, fallback = 'Not specified') {
  if (value === null || value === undefined || String(value).trim() === '') return fallback;
  return String(value);
}

export default function PropertyRequestsScreen() {
  const navigation = useNavigation<any>();
  const [requests, setRequests] = useState<PropertyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadRequests = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const response = await fetch(REQUESTS_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': WEBHOOK_SECRET_KEY,
        },
        body: JSON.stringify({ action: 'list_pending', status: 'pending' }),
      });
      if (!response.ok) throw new Error(`Request list failed (HTTP ${response.status})`);
      const payload = await response.json();
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.requests)
          ? payload.requests
          : Array.isArray(payload?.data)
            ? payload.data
            : [];
      setRequests(rows.filter((row: PropertyRequest) =>
        String(row.status ?? '').toLowerCase() === 'pending'
      ));
    } catch (e: any) {
      setError(e?.message || 'Could not load property requests.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadRequests();
  }, [loadRequests]));

  const markComplete = (item: PropertyRequest) => {
    Alert.alert(
      'Mark request complete?',
      `This will mark ${item.requestId} as complete and remove it from the pending list.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            setCompletingId(item.requestId);
            try {
              const response = await fetch(COMPLETE_WEBHOOK_URL, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': WEBHOOK_SECRET_KEY,
                },
                body: JSON.stringify({
                  action: 'complete',
                  requestId: item.requestId,
                  status: 'complete',
                }),
              });
              if (!response.ok) throw new Error(`Update failed (HTTP ${response.status})`);
              const result = await response.json().catch(() => ({}));
              if (result?.success === false || result?.updated === false) {
                throw new Error(result?.message || 'The request was not updated in MongoDB.');
              }
              setRequests(current => current.filter(r => r.requestId !== item.requestId));
            } catch (e: any) {
              Alert.alert(
                'Could not complete request',
                `${e?.message || 'Please try again.'}\n\nCheck that the n8n completion webhook is active and updates request_notif by requestId.`
              );
            } finally {
              setCompletingId(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: PropertyRequest }) => {
    const busy = completingId === item.requestId;
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.homeIcon}>
            <Ionicons name="home-outline" size={21} color={BLUE} />
          </View>
          <View style={styles.requestMeta}>
            <Text style={styles.requestId} numberOfLines={1}>{item.requestId}</Text>
            <View style={styles.pendingPill}>
              <View style={styles.pendingDot} />
              <Text style={styles.pendingText}>Pending</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.completeButton, busy && styles.completeDisabled]}
            onPress={() => markComplete(item)}
            disabled={!!completingId}
            accessibilityRole="button"
            accessibilityLabel={`Mark ${item.requestId} complete`}
          >
            {busy
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="checkmark" size={23} color="#fff" />}
          </TouchableOpacity>
        </View>

        <Text style={styles.location} numberOfLines={2}>
          {display(item.location, 'Location not specified')}
        </Text>

        <View style={styles.detailsGrid}>
          <Detail icon="bed-outline" label="BHK" value={display(item.bhk)} />
          <Detail icon="wallet-outline" label="Budget" value={display(item.budget ?? item.price)} />
          <Detail icon="business-outline" label="Society" value={display(item.society)} />
        </View>
        {item.sessionId ? (
          <Text style={styles.session}>Session: {item.sessionId}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BLUE} />
      <LinearGradient colors={[BLUE, '#2563EB']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerIcon}>
          <Ionicons name="clipboard-outline" size={22} color="#fff" />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Property Requests</Text>
          <Text style={styles.subtitle}>Pending requirements from MongoDB</Text>
        </View>
        <View style={styles.countPill}><Text style={styles.countText}>{requests.length}</Text></View>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.sectionRow}>
          <View>
            <Text style={styles.sectionTitle}>Needs attention</Text>
            <Text style={styles.sectionSub}>Tap the tick when a request is handled.</Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={() => loadRequests(true)} disabled={refreshing}>
            {refreshing
              ? <ActivityIndicator size="small" color={BLUE} />
              : <Ionicons name="refresh" size={19} color={BLUE} />}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={BLUE} />
            <Text style={styles.stateText}>Loading pending requests…</Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <View style={styles.emptyIcon}><Ionicons name="cloud-offline-outline" size={30} color="#DC2626" /></View>
            <Text style={styles.emptyTitle}>Could not load requests</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Text style={styles.hint}>The n8n list webhook must return pending documents from the request_notif collection.</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => loadRequests()}>
              <Ionicons name="refresh" size={17} color="#fff" />
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={requests}
            keyExtractor={(item, index) => item.requestId || item._id || item.id || String(index)}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={requests.length ? styles.list : styles.emptyList}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => loadRequests(true)} tintColor={BLUE} />
            }
            ListEmptyComponent={
              <View style={styles.centerState}>
                <View style={styles.emptyIcon}><Ionicons name="checkmark-done-circle-outline" size={34} color="#16A34A" /></View>
                <Text style={styles.emptyTitle}>All caught up!</Text>
                <Text style={styles.stateText}>There are no pending property requests.</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function Detail({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Ionicons name={icon as any} size={16} color="#64748B" />
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 16, gap: 10 },
  backButton: { padding: 5, marginRight: 1 },
  headerIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.17)', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.82)', fontSize: 11, marginTop: 3 },
  countPill: { minWidth: 32, height: 32, borderRadius: 16, paddingHorizontal: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  countText: { color: BLUE, fontWeight: '800', fontSize: 14 },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 20 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#172033' },
  sectionSub: { color: '#64748B', fontSize: 12, marginTop: 4 },
  refreshButton: { height: 38, width: 38, borderRadius: 12, backgroundColor: '#E4EDFF', alignItems: 'center', justifyContent: 'center' },
  list: { paddingBottom: 28, gap: 12 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 15, borderWidth: 1, borderColor: '#E5EAF2', shadowColor: '#1E293B', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  homeIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#EAF1FF', alignItems: 'center', justifyContent: 'center' },
  requestMeta: { flex: 1, minWidth: 0 },
  requestId: { fontSize: 12, color: '#334155', fontWeight: '800' },
  pendingPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFF7E6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, marginTop: 5 },
  pendingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D97706' },
  pendingText: { color: '#92400E', fontSize: 10, fontWeight: '700' },
  completeButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center' },
  completeDisabled: { opacity: 0.55 },
  location: { color: '#172033', fontSize: 16, fontWeight: '800', marginTop: 14, marginBottom: 12 },
  detailsGrid: { gap: 10 },
  detail: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  detailCopy: { flex: 1 },
  detailLabel: { color: '#64748B', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { color: '#334155', fontSize: 13, fontWeight: '600', marginTop: 2 },
  session: { color: '#94A3B8', fontSize: 10, marginTop: 12 },
  centerState: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 36 },
  emptyIcon: { width: 66, height: 66, borderRadius: 22, backgroundColor: '#E8F8EE', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { color: '#172033', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  stateText: { color: '#64748B', fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 7 },
  hint: { color: '#64748B', fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 10 },
  retryButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: BLUE, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, marginTop: 16 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
