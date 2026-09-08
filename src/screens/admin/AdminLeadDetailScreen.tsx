import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Linking, ActivityIndicator, Modal,
} from 'react-native';
import { CrossPlatformDateTimePicker } from '../../components/common';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import axiosInstance from '../../api/axiosInstance';
import { useLeadStore } from '../../store/leadStore';
import { useCustomFieldStore } from '../../store/customFieldStore';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { LeadStatus } from '../../types/lead.types';

const STATUS_COLORS: Record<string, string> = {
  'New': '#6B7280',
  'Interested': '#EF4444',
  'Contacted': '#F59E0B',
  'Not Interested': '#3B82F6',
  'Pending': '#D97706',
  'Booked': '#059669',
  'Deleted': '#9CA3AF',
};

const ALL_STATUSES: LeadStatus[] = [
  'Interested', 'Contacted', 'Not Interested', 'Pending', 'Booked',
];

const TIMELINE_ICONS: Record<string, string> = {
  created: 'add-circle',
  status_changed: 'flag',
  note_added: 'document-text',
  followup_added: 'calendar',
  assigned: 'swap-horizontal',
  appointment_set: 'time',
};

const InfoRow = ({ icon, label, value }: any) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIcon}>
      <Ionicons name={icon} size={16} color={colors.primary} />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  </View>
);

function formatCustomFieldValue(value: any, type: string): string {
  if (value === undefined || value === null || value === '') return '';
  if (type === 'date') {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return String(value);
}

export default function AdminLeadDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { leadId } = route.params || {};
  const { selectedLead, fetchLeadById, isLoading, updateStatus, clearSelectedLead } = useLeadStore();
  const { fields: customFields, fetchFields } = useCustomFieldStore();

  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  // ── Visitor date + time picker state ──
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pendingDate, setPendingDate] = useState<Date | null>(null); // date chosen, waiting for time

  useEffect(() => {
    if (!leadId) { navigation.goBack(); return; }
    fetchLeadById(leadId);
    return () => { clearSelectedLead(); };
  }, [leadId]);

  useEffect(() => {
    fetchFields(true);
  }, []);

  const lead = selectedLead;

  if (isLoading || !lead) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = STATUS_COLORS[lead.status] || colors.primary;

  const handleStatusChange = async (newStatus: LeadStatus) => {
    setShowStatusModal(false);
    if (newStatus === 'Booked') {
      Toast.show({
        type: 'info',
        text1: 'Use Employee view',
        text2: 'Book appointments via employee lead detail',
        visibilityTime: 2500,
      });
      return;
    }
    try {
      await updateStatus(leadId, newStatus);
      Toast.show({
        type: 'success',
        text1: 'Status Updated ✅',
        text2: `Status changed to ${newStatus}`,
        visibilityTime: 2000,
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Update Failed ❌',
        text2: 'Could not update status',
      });
    }
  };

  // Step 1 — date selected → open time picker
  const handleDateSelected = (selectedDate: Date) => {
    setShowDatePicker(false);
    setPendingDate(selectedDate);
    // Small delay taaki date picker close ho pehle
    setTimeout(() => setShowTimePicker(true), 300);
  };

  // Step 2 — time selected → combine date + time → save
  const handleTimeSelected = async (selectedTime: Date) => {
    setShowTimePicker(false);
    const base = pendingDate || new Date();

    // Date aur time combine karo
    const combined = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      selectedTime.getHours(),
      selectedTime.getMinutes(),
      0,
    );

    const dateStr = combined.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
    const timeStr = combined.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    });

    try {
      await axiosInstance.patch(`/leads/${leadId}/visitor-date`, {
        visitorDate: dateStr,
        visitorTime: timeStr,
      });
      await fetchLeadById(leadId);
      Toast.show({
        type: 'success',
        text1: 'Visitor Date & Time Set ✅',
        text2: `${dateStr} at ${timeStr}`,
        visibilityTime: 2500,
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Update Failed ❌',
        text2: 'Could not update visitor date',
      });
    }
    setPendingDate(null);
  };

  // Agar user time picker close kare bina select kiye — sirf date save karo
  const handleTimeClose = async () => {
    setShowTimePicker(false);
    if (!pendingDate) return;

    const dateStr = pendingDate.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
    try {
      await axiosInstance.patch(`/leads/${leadId}/visitor-date`, {
        visitorDate: dateStr,
        visitorTime: null,
      });
      await fetchLeadById(leadId);
      Toast.show({
        type: 'success',
        text1: 'Visitor Date Set ✅',
        text2: dateStr,
        visibilityTime: 2000,
      });
    } catch {
      Toast.show({ type: 'error', text1: 'Update Failed ❌', text2: 'Could not update visitor date' });
    }
    setPendingDate(null);
  };

  // visitorTime lead pe stored hai
  const visitorTime = (lead as any).visitorTime;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lead Details</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.editHeaderBtn}
            onPress={() => navigation.navigate('EditLead', { leadId })}
          >
            <Ionicons name="pencil-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.assignHeaderBtn}
            onPress={() => navigation.navigate('AssignLead', {
              leadId: lead._id,
              currentEmployee: lead.assignedTo,
            })}
          >
            <Ionicons name="swap-horizontal" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Profile */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {lead.name?.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.leadName}>{lead.name}</Text>
          <Text style={styles.leadPhone}>{lead.phone}</Text>
          {lead.secondaryPhone ? (
            <Text style={styles.leadPhone}>📱 {lead.secondaryPhone}</Text>
          ) : null}
          <TouchableOpacity
            style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}
            onPress={() => setShowStatusModal(true)}
          >
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{lead.status}</Text>
            <Ionicons name="chevron-down" size={14} color={statusColor} />
          </TouchableOpacity>

          {/* Assigned To */}
          <View style={styles.assignedBadge}>
            <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.assignedText}>
              {typeof lead.assignedTo === 'object'
                ? (lead.assignedTo as any)?.name || 'Unassigned'
                : 'Unassigned'}
            </Text>
          </View>

          {/* Visitor Date + Time badge — tap to edit */}
          <TouchableOpacity
            style={styles.visitorDateBtn}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar" size={14} color={colors.white} />
            <Text style={styles.visitorDateText}>
              {lead.visitorDate
                ? `${lead.visitorDate}${visitorTime ? `  🕐 ${visitorTime}` : ''}`
                : 'Set Visitor Date & Time'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => Linking.openURL(`tel:${lead.phone}`)}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#e3f5f8' }]}>
              <Ionicons name="call" size={22} color={colors.primary} />
            </View>
            <Text style={styles.actionLabel}>Call</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => Linking.openURL(`https://wa.me/91${lead.phone}`)}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#E8FFF1' }]}>
              <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
            </View>
            <Text style={styles.actionLabel}>WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('AddNote', { leadId: lead._id })}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="document-text" size={22} color="#6366F1" />
            </View>
            <Text style={styles.actionLabel}>Add Note</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setShowTimelineModal(true)}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FEF9E7' }]}>
              <Ionicons name="time" size={22} color="#F59E0B" />
            </View>
            <Text style={styles.actionLabel}>Timeline</Text>
          </TouchableOpacity>
        </View>

        {/* Customer Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Customer Information</Text>
          <InfoRow icon="person" label="Name" value={lead.name} />
          <InfoRow icon="call" label="Primary Phone" value={lead.phone} />
          {lead.secondaryPhone ? (
            <InfoRow icon="call-outline" label="Secondary Phone" value={lead.secondaryPhone} />
          ) : null}
          <InfoRow icon="mail" label="Email" value={lead.email} />
          <InfoRow icon="location" label="City" value={lead.city} />
          {lead.customFields && Object.entries(
            lead.customFields instanceof Map
              ? Object.fromEntries(lead.customFields)
              : (lead.customFields as Record<string, any>)
          )
            .filter(([, val]) => val !== undefined && val !== null && val !== '')
            .map(([key, val]) => {
              const def = customFields.find((f) => f.key === key);
              const label = def?.label ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
              const type = def?.type ?? 'text';
              return (
                <InfoRow
                  key={key}
                  icon="information-circle-outline"
                  label={label}
                  value={formatCustomFieldValue(val, type)}
                />
              );
            })}
        </View>

        {/* Lead Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Lead Information</Text>
          <InfoRow icon="globe" label="Source" value={lead.source} />
          <InfoRow icon="megaphone" label="Campaign" value={lead.campaign} />
          <InfoRow icon="time-outline" label="Created"
            value={new Date(lead.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric'
            })} />
        </View>

        {/* Visitor Section */}
        {(lead.visitorDate || visitorTime) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Visitor Schedule</Text>
            {lead.visitorDate ? (
              <InfoRow icon="calendar" label="Visitor Date" value={lead.visitorDate} />
            ) : null}
            {visitorTime ? (
              <InfoRow icon="time" label="Visitor Time" value={visitorTime} />
            ) : null}
          </View>
        )}

        {/* Notes */}
        {lead.notes && lead.notes.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Notes ({lead.notes.length})</Text>
            {(lead.notes as any[]).map((note, index) => (
              <View key={index} style={styles.noteItem}>
                <Text style={styles.noteContent}>{note.content}</Text>
                <Text style={styles.noteTime}>
                  {new Date(note.createdAt).toLocaleDateString('en-IN')}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* Status Modal */}
      <Modal
        visible={showStatusModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowStatusModal(false)}
          activeOpacity={1}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Change Status</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {ALL_STATUSES.map((status) => {
                const sColor = STATUS_COLORS[status];
                const isActive = lead.status === status;
                return (
                  <TouchableOpacity
                    key={status}
                    style={[styles.statusOption, isActive && styles.statusOptionActive]}
                    onPress={() => handleStatusChange(status)}
                  >
                    <View style={[styles.statusDot, { backgroundColor: sColor }]} />
                    <Text style={[
                      styles.statusOptionText,
                      isActive && { color: colors.primary, fontWeight: typography.bold },
                    ]}>
                      {status}
                    </Text>
                    {isActive && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Step 1 — Date Picker */}
      {showDatePicker && (
        <CrossPlatformDateTimePicker
          visible={showDatePicker}
          value={new Date()}
          mode="date"
          title="Select Visitor Date"
          onChange={handleDateSelected}
          onClose={() => setShowDatePicker(false)}
        />
      )}

      {/* Step 2 — Time Picker (opens after date is chosen) */}
      {showTimePicker && (
        <CrossPlatformDateTimePicker
          visible={showTimePicker}
          value={new Date()}
          mode="time"
          title="Select Visitor Time"
          onChange={handleTimeSelected}
          onClose={handleTimeClose}
        />
      )}

      {/* Timeline Modal */}
      <Modal
        visible={showTimelineModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimelineModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowTimelineModal(false)}
          activeOpacity={1}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Activity Timeline</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {lead.timeline && lead.timeline.length > 0 ? (
                [...lead.timeline]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((entry) => (
                    <View key={entry._id} style={styles.timelineRow}>
                      <View style={styles.timelineIconWrap}>
                        <Ionicons
                          name={(TIMELINE_ICONS[entry.type] || 'ellipse') as any}
                          size={16}
                          color={colors.primary}
                        />
                      </View>
                      <View style={styles.timelineContent}>
                        <Text style={styles.timelineDescription}>{entry.description}</Text>
                        <Text style={styles.timelineTime}>
                          {new Date(entry.createdAt).toLocaleString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit', hour12: true,
                          })}
                        </Text>
                      </View>
                    </View>
                  ))
              ) : (
                <Text style={styles.timelineEmptyText}>No activity recorded yet</Text>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base, paddingVertical: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40, height: 40, justifyContent: 'center',
    alignItems: 'center', backgroundColor: colors.background,
    borderRadius: 10,
  },
  headerTitle: {
    fontSize: typography.lg, fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  editHeaderBtn: {
    width: 40, height: 40, justifyContent: 'center',
    alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: 10,
  },
  assignHeaderBtn: {
    width: 40, height: 40, justifyContent: 'center',
    alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: 10,
  },
  profileCard: {
    backgroundColor: colors.white, alignItems: 'center',
    padding: spacing.xl, marginBottom: spacing.sm, gap: spacing.sm,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: {
    fontSize: typography.xxxl, fontWeight: typography.bold, color: colors.primary,
  },
  leadName: {
    fontSize: typography.xl, fontWeight: typography.bold, color: colors.textPrimary,
  },
  leadPhone: { fontSize: typography.base, color: colors.textSecondary },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.xs, paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs, borderRadius: 20,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: typography.sm, fontWeight: typography.semiBold },
  assignedBadge: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.xs, backgroundColor: colors.background,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 20,
  },
  assignedText: { fontSize: typography.sm, color: colors.textSecondary },
  actionRow: {
    flexDirection: 'row', backgroundColor: colors.white,
    paddingVertical: spacing.md, paddingHorizontal: spacing.base,
    marginBottom: spacing.sm, justifyContent: 'space-around',
  },
  actionBtn: { alignItems: 'center', gap: spacing.xs },
  actionIcon: {
    width: 52, height: 52, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  actionLabel: {
    fontSize: typography.xs, color: colors.textSecondary, fontWeight: typography.medium,
  },
  card: {
    backgroundColor: colors.white, marginHorizontal: spacing.base,
    marginBottom: spacing.sm, borderRadius: 16, padding: spacing.base, elevation: 1,
  },
  cardTitle: {
    fontSize: typography.md, fontWeight: typography.bold,
    color: colors.textPrimary, marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  infoIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: typography.xs, color: colors.textSecondary },
  infoValue: {
    fontSize: typography.sm, fontWeight: typography.medium,
    color: colors.textPrimary, marginTop: 2,
  },
  visitorDateBtn: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.sm, backgroundColor: '#06B6D4',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: 20, marginTop: spacing.xs,
  },
  visitorDateText: {
    fontSize: typography.sm, color: colors.white, fontWeight: typography.semiBold,
  },
  noteItem: {
    backgroundColor: colors.background, borderRadius: 10,
    padding: spacing.md, marginBottom: spacing.sm,
    borderLeftWidth: 3, borderLeftColor: colors.primary,
  },
  noteContent: { fontSize: typography.sm, color: colors.textPrimary },
  noteTime: { fontSize: typography.xs, color: colors.textSecondary, marginTop: 4 },
  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white, borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: spacing.base, maxHeight: '70%', paddingBottom: 50,
  },
  modalTitle: {
    fontSize: typography.lg, fontWeight: typography.bold,
    color: colors.textPrimary, marginBottom: spacing.md, textAlign: 'center',
  },
  timelineRow: {
    flexDirection: 'row', gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  timelineIconWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  timelineContent: { flex: 1 },
  timelineDescription: { fontSize: typography.sm, color: colors.textPrimary },
  timelineTime: { fontSize: typography.xs, color: colors.textSecondary, marginTop: 2 },
  timelineEmptyText: {
    fontSize: typography.sm, color: colors.textSecondary,
    textAlign: 'center', paddingVertical: spacing.xl,
  },
  statusOption: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.md, paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm, borderRadius: 10, marginBottom: 4,
  },
  statusOptionActive: { backgroundColor: colors.primaryLight },
  statusOptionText: { flex: 1, fontSize: typography.base, color: colors.textPrimary },
});
