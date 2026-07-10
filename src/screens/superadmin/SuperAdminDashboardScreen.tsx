import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSuperAdminStore } from '../../store/superAdminStore';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

export default function SuperAdminDashboardScreen() {
  const navigation = useNavigation<any>();
  const { user, logout } = useAuthStore();
  const { organizations, isLoading, fetchOrganizations } = useSuperAdminStore();
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    fetchOrganizations().catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrganizations().catch(() => {});
    setRefreshing(false);
  };

  const totalOrgs = organizations.length;
  const activeOrgs = organizations.filter((o) => o.isActive).length;
  const totalAdmins = organizations.reduce((sum, o) => sum + o.adminCount, 0);
  const totalLeads = organizations.reduce((sum, o) => sum + o.totalLeads, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerEyebrow}>Super Admin</Text>
          <Text style={styles.headerTitle}>{user?.name || 'Monitoring Panel'}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => logout()}>
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Stat summary */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalOrgs}</Text>
            <Text style={styles.statLabel}>Organizations</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{activeOrgs}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalAdmins}</Text>
            <Text style={styles.statLabel}>Admins</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalLeads}</Text>
            <Text style={styles.statLabel}>Total Leads</Text>
          </View>
        </View>

        {/* Add new org/admin */}
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('SuperAdminAddAdmin')}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle" size={20} color={colors.white} />
          <Text style={styles.addBtnText}>Add New Organization & Admin</Text>
        </TouchableOpacity>

        {/* Organizations list */}
        <Text style={styles.sectionTitle}>Organizations</Text>

        {isLoading && organizations.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : organizations.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="business-outline" size={40} color={colors.textLight} />
            <Text style={styles.emptyText}>No organizations yet</Text>
          </View>
        ) : (
          organizations.map((org) => (
            <TouchableOpacity
              key={org._id}
              style={styles.orgCard}
              onPress={() => navigation.navigate('SuperAdminOrgAdmins', { orgId: org._id, orgName: org.name })}
              activeOpacity={0.8}
            >
              <View style={styles.orgIconWrap}>
                <Ionicons name="business" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.orgName} numberOfLines={1}>{org.name}</Text>
                <Text style={styles.orgMeta}>
                  {org.businessType || 'General'} · {org.adminCount} admin{org.adminCount !== 1 ? 's' : ''} · {org.totalLeads} leads
                </Text>
              </View>
              <View style={[styles.statusDot, { backgroundColor: org.isActive ? colors.success : colors.error }]} />
              <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: typography.bold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  logoutBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: colors.background,
    justifyContent: 'center', alignItems: 'center',
  },

  content: { padding: spacing.base, gap: spacing.md },

  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: spacing.md,
    elevation: 1,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  statValue: {
    fontSize: typography.xl,
    fontWeight: typography.extraBold,
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: spacing.md,
    elevation: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  addBtnText: {
    color: colors.white,
    fontSize: typography.base,
    fontWeight: typography.bold,
  },

  sectionTitle: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.xs,
  },

  orgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: spacing.md,
    elevation: 1,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  orgIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  orgName: {
    fontSize: typography.base,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  orgMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusDot: {
    width: 9, height: 9, borderRadius: 5,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: typography.base,
    color: colors.textLight,
  },
});
