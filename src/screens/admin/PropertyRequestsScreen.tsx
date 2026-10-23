import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, RefreshControl,
  SafeAreaView, ScrollView, StatusBar, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
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
  notes?: string;
  createdAt?: string;
};

type EditDraft = {
  location: string;
  bhk: string;
  budget: string;
  society: string;
  propertyType: string;
  notes: string;
};

const BLUE = '#2157C9';

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({
  visible,
  item,
  onClose,
  onSave,
  saving,
}: {
  visible: boolean;
  item: PropertyRequest | null;
  onClose: () => void;
  onSave: (draft: EditDraft & { markComplete: boolean }) => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<EditDraft>({
    location: '', bhk: '', budget: '', society: '', propertyType: '', notes: '',
  });
  const [markComplete, setMarkComplete] = useState(false);

  useEffect(() => {
    if (item) {
      setDraft({
        location: item.location || '',
        bhk: String(item.bhk ?? ''),
        budget: String(item.budget ?? item.price ?? ''),
        society: item.society || '',
        propertyType: item.propertyType || '',
        notes: (item as any).notes || '',
      });
      setMarkComplete(false);
    }
  }, [item]);

  const Field = ({
    label, field, placeholder, keyboardType = 'default',
  }: {
    label: string;
    field: keyof EditDraft;
    placeholder?: string;
    keyboardType?: any;
  }) => (
    <View style={ms.field}>
      <Text style={ms.label}>{label}</Text>
      <TextInput
        style={ms.input}
        value={draft[field]}
        placeholder={placeholder || label}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType}
        onChangeText={(v) => setDraft((d) => ({ ...d, [field]: v }))}
      />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={ms.backdrop}>
        <View style={ms.sheet}>
          {/* Header */}
          <View style={ms.sheetHeader}>
            <Text style={ms.sheetTitle}>Edit Request</Text>
            <TouchableOpacity onPress={onClose} style={ms.closeBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
            <Field label="Society / Project" field="society" placeholder="e.g. Sunshine Heights" />
            <Field label="Location / Area" field="location" placeholder="e.g. Pune, Kothrud" />
            <Field label="BHK Config" field="bhk" placeholder="e.g. 2BHK" />
            <Field label="Budget (₹)" field="budget" placeholder="e.g. 45 Lakh" keyboardType="default" />
            <Field label="Property Type" field="propertyType" placeholder="Flat / Shop / Plot" />
            <Field label="Notes" field="notes" placeholder="Any extra details…" />

            {/* Mark complete toggle */}
            <TouchableOpacity
              style={ms.completeRow}
              onPress={() => setMarkComplete((v) => !v)}
              activeOpacity={0.8}
            >
              <View style={[ms.checkbox, markComplete && ms.checkboxChecked]}>
                {markComplete && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={ms.completeLabel}>Mark as Complete & Remove from list</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Footer buttons */}
          <View style={ms.footer}>
            <TouchableOpacity style={ms.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={ms.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ms.saveBtn, saving && { opacity: 0.6 }]}
              onPress={() => onSave({ ...draft, markComplete })}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={ms.saveText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function PropertyRequestsScreen() {
  const navigation = useNavigation<any>();
  const [requests, setRequests] = useState<PropertyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Edit modal state
  const [editItem, setEditItem] = useState<PropertyRequest | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadRequests = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const response = await axiosInstance.get('/property-requests?status=pending');
      const payload = response.data;
      const rows = Array.isArray(payload)
        ? payload
        : (payload?.data ?? payload?.requests ?? payload?.items ?? []);
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

  // Open edit modal
  const openEdit = (item: PropertyRequest) => {
    setEditItem(item);
    setEditVisible(true);
  };

  // Save edit (PATCH /api/property-requests/:requestId)
  const handleSave = async (draft: EditDraft & { markComplete: boolean }) => {
    if (!editItem?.requestId) return;
    setSaving(true);
    try {
      const body: Record<string, any> = {
        location:     draft.location   || undefined,
        bhk:          draft.bhk        || undefined,
        budget:       draft.budget     || undefined,
        society:      draft.society    || undefined,
        propertyType: draft.propertyType || undefined,
        notes:        draft.notes      || undefined,
      };
      if (draft.markComplete) body.status = 'complete';

      await axiosInstance.patch(
        `/property-requests/${encodeURIComponent(editItem.requestId)}`,
        body
      );

      if (draft.markComplete) {
        // Remove from list
        setRequests((cur) => cur.filter((r) => r.requestId !== editItem.requestId));
        Toast.show({ type: 'success', text1: 'Request marked complete ✓' });
      } else {
        // Refresh
        await loadRequests();
        Toast.show({ type: 'success', text1: 'Request updated ✓' });
      }
      setEditVisible(false);
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not save',
        text2: e?.response?.data?.message || e?.message || 'Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Quick complete (tick button)
  const quickComplete = (item: PropertyRequest) => {
    if (!item.requestId) {
      Toast.show({ type: 'error', text1: 'Request ID missing' });
      return;
    }
    Alert.alert('Mark as complete?', 'This request will be removed from the pending list.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete', onPress: async () => {
          try {
            await axiosInstance.patch(`/property-requests/${encodeURIComponent(item.requestId)}/complete`);
            setRequests((cur) => cur.filter((r) => r.requestId !== item.requestId));
            Toast.show({ type: 'success', text1: 'Request completed ✓' });
          } catch (e: any) {
            Toast.show({ type: 'error', text1: 'Error', text2: e?.response?.data?.message || e?.message });
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: PropertyRequest }) => (
    <View style={styles.card}>
      <View style={styles.cardMain}>
        {/* Title row */}
        <View style={styles.cardTitleRow}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => openEdit(item)} activeOpacity={0.8}>
            <Text style={styles.society} numberOfLines={2}>
              {item.society || item.location || 'Property requirement'}
            </Text>
          </TouchableOpacity>
          {/* Edit button */}
          <TouchableOpacity style={styles.editButton} onPress={() => openEdit(item)}>
            <Ionicons name="pencil-outline" size={17} color={BLUE} />
          </TouchableOpacity>
          {/* Complete tick */}
          <TouchableOpacity style={styles.checkButton} onPress={() => quickComplete(item)}>
            <Ionicons name="checkmark" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <Text style={styles.location}>
          <Ionicons name="location-outline" size={13} color="#64748B" />{' '}
          {item.location || 'Location not specified'}
        </Text>

        <View style={styles.chips}>
          {!!item.bhk && <View style={styles.chip}><Text style={styles.chipText}>{item.bhk} BHK</Text></View>}
          {!!(item.budget ?? item.price) && (
            <View style={styles.chip}><Text style={styles.chipText}>₹ {item.budget ?? item.price}</Text></View>
          )}
          {!!item.propertyType && (
            <View style={styles.chip}><Text style={styles.chipText}>{item.propertyType}</Text></View>
          )}
        </View>

        {!!(item as any).notes && (
          <Text style={styles.notes} numberOfLines={2}>{(item as any).notes}</Text>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.requestId}>ID: {item.requestId}</Text>
          <TouchableOpacity style={styles.editLink} onPress={() => openEdit(item)}>
            <Text style={styles.editLinkText}>Edit details</Text>
            <Ionicons name="chevron-forward" size={13} color={BLUE} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BLUE} />
      <LinearGradient colors={['#1947A9', '#2563EB']} style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={23} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerIcon}>
          <Ionicons name="clipboard-outline" size={23} color="#fff" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Property Requests</Text>
          <Text style={styles.headerSub}>Pending requirements — tap a card to edit</Text>
        </View>
        <View style={styles.count}>
          <Text style={styles.countText}>{requests.length}</Text>
        </View>
      </LinearGradient>

      <View style={styles.sectionHead}>
        <View>
          <Text style={styles.sectionTitle}>Needs attention</Text>
          <Text style={styles.sectionSub}>Edit details or tick ✓ when handled.</Text>
        </View>
        <TouchableOpacity style={styles.refresh} onPress={() => loadRequests(true)}>
          <Ionicons name="refresh" size={20} color={BLUE} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BLUE} />
          <Text style={styles.muted}>Loading requests…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}><Ionicons name="cloud-offline-outline" size={32} color="#DC2626" /></View>
          <Text style={styles.emptyTitle}>Could not load requests</Text>
          <Text style={styles.muted}>{error}</Text>
          <TouchableOpacity style={styles.retry} onPress={() => loadRequests()}>
            <Ionicons name="refresh" size={17} color="#fff" />
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}><Ionicons name="checkmark-done-circle-outline" size={34} color="#16A34A" /></View>
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.muted}>No pending property requests.</Text>
          <TouchableOpacity style={styles.retry} onPress={() => loadRequests()}>
            <Ionicons name="refresh" size={17} color="#fff" />
            <Text style={styles.retryText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item, index) => item.requestId || item._id || item.id || String(index)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadRequests(true)} tintColor={BLUE} />}
        />
      )}

      <EditModal
        visible={editVisible}
        item={editItem}
        onClose={() => setEditVisible(false)}
        onSave={handleSave}
        saving={saving}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#F2F5FA' },
  header:       { minHeight: 76, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  back:         { padding: 4 },
  headerIcon:   { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerText:   { flex: 1 },
  headerTitle:  { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub:    { color: '#DCE8FF', fontSize: 11, marginTop: 3 },
  count:        { backgroundColor: '#fff', minWidth: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  countText:    { color: BLUE, fontWeight: '800' },
  sectionHead:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  sectionSub:   { fontSize: 12, color: '#64748B', marginTop: 5 },
  refresh:      { backgroundColor: '#E3ECFF', width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  list:         { paddingHorizontal: 14, paddingBottom: 32 },
  card:         { backgroundColor: '#fff', borderRadius: 16, marginBottom: 11, borderWidth: 1, borderColor: '#E5EAF2', elevation: 2, shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  cardMain:     { padding: 15 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  society:      { flex: 1, color: '#111827', fontSize: 16, fontWeight: '800', paddingTop: 5 },
  editButton:   { width: 36, height: 36, borderRadius: 11, backgroundColor: '#EEF4FF', alignItems: 'center', justifyContent: 'center' },
  checkButton:  { width: 36, height: 36, borderRadius: 11, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center' },
  location:     { color: '#64748B', fontSize: 13, marginTop: 6 },
  chips:        { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  chip:         { backgroundColor: '#EEF4FF', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 },
  chipText:     { color: '#1D4ED8', fontSize: 12, fontWeight: '700' },
  notes:        { color: '#475569', fontSize: 12, marginTop: 8, lineHeight: 18 },
  cardFooter:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  requestId:    { color: '#94A3B8', fontSize: 10 },
  editLink:     { flexDirection: 'row', alignItems: 'center', gap: 2 },
  editLinkText: { color: BLUE, fontSize: 12, fontWeight: '700' },
  // center / empty states
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 70 },
  emptyIcon:    { width: 66, height: 66, borderRadius: 20, backgroundColor: '#E6F8ED', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  emptyTitle:   { fontSize: 17, fontWeight: '800', color: '#111827', textAlign: 'center' },
  muted:        { color: '#64748B', fontSize: 13, textAlign: 'center', marginTop: 9, lineHeight: 20 },
  retry:        { marginTop: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1D4ED8', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  retryText:    { color: '#fff', fontWeight: '700', fontSize: 13 },
});

// ── Edit Modal Styles ─────────────────────────────────────────────────────────
const ms = StyleSheet.create({
  backdrop:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', paddingBottom: 34 },
  sheetHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  sheetTitle:   { fontSize: 18, fontWeight: '800', color: '#111827' },
  closeBtn:     { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  field:        { paddingHorizontal: 20, paddingTop: 14 },
  label:        { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input:        { backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#111827' },
  completeRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  checkbox:     { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  completeLabel:{ fontSize: 14, color: '#374151', flex: 1, fontWeight: '600' },
  footer:       { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  cancelBtn:    { flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center' },
  cancelText:   { color: '#64748B', fontWeight: '700', fontSize: 15 },
  saveBtn:      { flex: 2, paddingVertical: 14, borderRadius: 14, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  saveText:     { color: '#fff', fontWeight: '800', fontSize: 15 },
});
