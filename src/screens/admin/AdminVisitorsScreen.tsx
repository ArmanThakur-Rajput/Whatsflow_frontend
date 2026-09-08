import React from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import axiosInstance from '../../api/axiosInstance';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { Lead } from '../../types/lead.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function parseVisitorDate(str: string): Date | null {
  if (!str) return null;
  const parts = str.trim().split(/\s+/);
  if (parts.length !== 3) return null;
  const [day, mon, year] = parts;
  const m = MONTHS[mon];
  if (m === undefined) return null;
  return new Date(+year, m, +day);
}

function visitorDateLabel(visitorDate: string): { label: string; isToday: boolean; isTomorrow: boolean } {
  const vd = parseVisitorDate(visitorDate);
  if (!vd) return { label: visitorDate, isToday: false, isTomorrow: false };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const isToday = vd.getTime() === today.getTime();
  const isTomorrow = vd.getTime() === tomorrow.getTime();

  if (isToday) return { label: 'Today', isToday: true, isTomorrow: false };
  if (isTomorrow) return { label: 'Tomorrow', isToday: false, isTomorrow: true };

  return { label: visitorDate, isToday: false, isTomorrow: false };
}

// ─── Visitor Card ─────────────────────────────────────────────────────────────

function VisitorCard({
  lead,
  onPress,
  onRemove,
}: {
  lead: Lead;
  onPress: () => void;
  onRemove: () => void;
}) {
  const { label, isToday, isTomorrow } = visitorDateLabel(lead.visitorDate || '');
  const visitorTime = (lead as any).visitorTime;

  const dateBg = isToday ? '#ECFDF5' : isTomorrow ? '#FEF9E7' : '#EFF6FF';
  const dateColor = isToday ? '#059669' : isTomorrow ? '#D97706' : '#3B82F6';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      {/* Left color bar */}
      <View style={[styles.colorBar, { backgroundColor: dateColor }]} />

      <View style={styles.cardBody}>
        {/* Top row: avatar + info */}
        <View style={styles.cardTop}>
          <View style={[styles.avatar, { backgroundColor: dateColor + '20' }]}>
            <Text style={[styles.avatarText, { color: dateColor }]}>
              {lead.name.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.leadInfo}>
            <Text style={styles.leadName} numberOfLines={1}>{lead.name}</Text>
            <Text style={styles.leadPhone}>{lead.phone}</Text>
            {(lead as any).assignedTo?.name ? (
              <Text style={styles.assignedTo}>
                👤 {(lead as any).assignedTo.name}
              </Text>
            ) : null}
          </View>

          {/* Visitor date badge */}
          <View style={[styles.dateBadge, { backgroundColor: dateBg }]}>
            <Ionicons name="calendar" size={12} color={dateColor} />
            <Text style={[styles.dateText, { color: dateColor }]}>{label}</Text>
          </View>
        </View>

        {/* Bottom row: status chip + visitor date + time + remove btn */}
        <View style={styles.cardBottom}>
          <View style={styles.statusChip}>
            <Text style={styles.statusText}>{lead.status}</Text>
          </View>

          {/* Date + Time display */}
          <View style={styles.dateTimeWrap}>
            <Text style={styles.fullDate}>{lead.visitorDate}</Text>
            {visitorTime ? (
              <View style={styles.timeBadge}>
                <Ionicons name="time-outline" size={11} color="#6366F1" />
                <Text style={styles.timeText}>{visitorTime}</Text>
              </View>
            ) : null}
          </View>

          {/* Remove (tick) button */}
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={onRemove}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="checkmark-circle" size={26} color="#059669" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AdminVisitorsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const fetchVisitors = async () => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get('/admin/visitors');
      setLeads(res.data.leads || []);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not load visitors' });
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchVisitors();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchVisitors();
    setRefreshing(false);
  };

  const handleRemove = (lead: Lead) => {
    Alert.alert(
      'Remove from Visitors?',
      `"${lead.name}"'s visitor date will be cleared. The lead will not be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await axiosInstance.patch(`/admin/visitors/${lead._id}/remove`);
              setLeads((prev) => prev.filter((l) => l._id !== lead._id));
              Toast.show({
                type: 'success',
                text1: 'Removed ✅',
                text2: `${lead.name} removed from visitors`,
                visibilityTime: 2000,
              });
            } catch {
              Toast.show({ type: 'error', text1: 'Failed ❌', text2: 'Could not remove visitor date' });
            }
          },
        },
      ]
    );
  };

  const sorted = React.useMemo(() => {
    return [...leads].sort((a, b) => {
      const da = parseVisitorDate(a.visitorDate || '');
      const db = parseVisitorDate(b.visitorDate || '');
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.getTime() - db.getTime();
    });
  }, [leads]);

  return (
    <View style={styles.wrapper}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Upcoming Visitors</Text>
            <Text style={styles.subtitle}>{sorted.length} scheduled</Text>
          </View>
        </View>

        {/* Info banner */}
        <View style={styles.banner}>
          <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.bannerText}>
            Tap the tick button to remove a visitor — the lead will not be deleted
          </Text>
        </View>

        <FlatList
          data={sorted}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <VisitorCard
              lead={item}
              onPress={() => navigation.navigate('AdminLeadDetail', { leadId: item._id })}
              onRemove={() => handleRemove(item)}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={64} color={colors.textLight} />
                <Text style={styles.emptyTitle}>No upcoming visitors</Text>
                <Text style={styles.emptySubtitle}>
                  Leads with a visitor date scheduled for today or later will appear here
                </Text>
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm, paddingBottom: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: typography.xl, fontWeight: typography.bold, color: colors.textPrimary },
  subtitle: { fontSize: typography.xs, color: colors.textSecondary, marginTop: 1 },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.base, marginTop: spacing.sm, marginBottom: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.primaryLight, borderRadius: 10,
    borderWidth: 1, borderColor: colors.primary + '40',
  },
  bannerText: { flex: 1, fontSize: typography.xs, color: colors.primaryDark },

  listContent: { paddingHorizontal: spacing.base, paddingTop: spacing.sm },

  card: {
    flexDirection: 'row',
    backgroundColor: colors.white, borderRadius: 14,
    overflow: 'hidden', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4,
  },
  colorBar: { width: 4 },
  cardBody: { flex: 1, padding: spacing.md, gap: spacing.xs },

  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: typography.lg, fontWeight: typography.bold },
  leadInfo: { flex: 1 },
  leadName: { fontSize: typography.base, fontWeight: typography.semiBold, color: colors.textPrimary },
  leadPhone: { fontSize: typography.sm, color: colors.textSecondary, marginTop: 1 },
  assignedTo: { fontSize: typography.xs, color: colors.textLight, marginTop: 2 },

  dateBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 8,
  },
  dateText: { fontSize: typography.xs, fontWeight: typography.bold },

  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  statusChip: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 6,
  },
  statusText: { fontSize: 10, color: colors.textSecondary, fontWeight: typography.medium },

  dateTimeWrap: { flex: 1, gap: 3 },
  fullDate: { fontSize: typography.xs, color: colors.textLight },
  timeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  timeText: { fontSize: 10, color: '#6366F1', fontWeight: typography.semiBold },

  removeBtn: { padding: 4 },

  emptyState: {
    alignItems: 'center', paddingTop: 80, gap: spacing.md, paddingHorizontal: spacing.xl,
  },
  emptyTitle: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.textSecondary },
  emptySubtitle: { fontSize: typography.sm, color: colors.textLight, textAlign: 'center', lineHeight: 20 },
});
