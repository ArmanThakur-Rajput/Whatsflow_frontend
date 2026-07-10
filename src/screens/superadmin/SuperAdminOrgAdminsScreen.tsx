import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useSuperAdminStore, AdminUser } from '../../store/superAdminStore';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

export default function SuperAdminOrgAdminsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { orgId, orgName } = route.params || {};

  const {
    organizations, fetchAdminsByOrg, toggleAdminStatus,
    deleteAdmin, toggleOrgStatus, isLoading,
  } = useSuperAdminStore();

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const org = organizations.find((o) => o._id === orgId);

  const load = useCallback(async () => {
    try {
      const data = await fetchAdminsByOrg(orgId);
      setAdmins(data);
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to load admins' });
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleToggleAdmin = async (admin: AdminUser) => {
    try {
      await toggleAdminStatus(admin._id);
      Toast.show({
        type: 'success',
        text1: admin.isActive ? 'Admin deactivated' : 'Admin activated',
      });
      load();
    } catch {
      Toast.show({ type: 'error', text1: 'Action failed' });
    }
  };

  const handleDeleteAdmin = (admin: AdminUser) => {
    Alert.alert(
      'Remove Admin',
      `Remove ${admin.name}'s login? This organization's data (leads, employees) will NOT be affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAdmin(admin._id);
              Toast.show({ type: 'success', text1: 'Admin removed' });
              load();
            } catch {
              Toast.show({ type: 'error', text1: 'Failed to remove admin' });
            }
          },
        },
      ]
    );
  };

  const handleToggleOrg = () => {
    if (!org) return;
    Alert.alert(
      org.isActive ? 'Deactivate Organization' : 'Activate Organization',
      org.isActive
        ? `${org.name} and all its admins/employees will be locked out. Their data stays intact.`
        : `${org.name} will regain access.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: org.isActive ? 'Deactivate' : 'Activate',
          style: org.isActive ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await toggleOrgStatus(orgId);
              Toast.show({ type: 'success', text1: `Organization ${org.isActive ? 'deactivated' : 'activated'}` });
            } catch {
              Toast.show({ type: 'error', text1: 'Action failed' });
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{orgName || org?.name || 'Organization'}</Text>
          <Text style={styles.headerSubtitle}>{org?.businessType || 'General'}</Text>
        </View>
        <TouchableOpacity onPress={handleToggleOrg} style={styles.orgToggleBtn}>
          <Ionicons
            name={org?.isActive ? 'pause-circle-outline' : 'play-circle-outline'}
            size={22}
            color={org?.isActive ? colors.error : colors.success}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Org status banner */}
        {org && !org.isActive && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={16} color="#92400E" />
            <Text style={styles.warningText}>This organization is deactivated — all its users are locked out.</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('SuperAdminAddAdmin', { orgId, orgName: org?.name })}
          activeOpacity={0.85}
        >
          <Ionicons name="person-add" size={18} color={colors.white} />
          <Text style={styles.addBtnText}>Add Admin to this Organization</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Admins ({admins.length})</Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : admins.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={36} color={colors.textLight} />
            <Text style={styles.emptyText}>No admins in this organization</Text>
          </View>
        ) : (
          admins.map((admin) => (
            <View key={admin._id} style={styles.adminCard}>
              <View style={styles.adminAvatar}>
                <Text style={styles.adminInitial}>{admin.name?.[0]?.toUpperCase() || '?'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.adminName} numberOfLines={1}>{admin.name}</Text>
                <Text style={styles.adminEmail} numberOfLines={1}>{admin.email}</Text>
                {admin.phone ? <Text style={styles.adminPhone}>{admin.phone}</Text> : null}
              </View>

              <View style={styles.adminActions}>
                <View style={[styles.statusBadge, { backgroundColor: admin.isActive ? '#D1FAE5' : '#FEE2E2' }]}>
                  <Text style={[styles.statusBadgeText, { color: admin.isActive ? '#047857' : '#B91C1C' }]}>
                    {admin.isActive ? 'Active' : 'Inactive'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => navigation.navigate('SuperAdminEditAdmin', { admin })}
                >
                  <Ionicons name="create-outline" size={18} color={colors.primary} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.iconBtn} onPress={() => handleToggleAdmin(admin)}>
                  <Ionicons
                    name={admin.isActive ? 'pause-outline' : 'play-outline'}
                    size={18}
                    color={admin.isActive ? colors.warning : colors.success}
                  />
                </TouchableOpacity>

                <TouchableOpacity style={styles.iconBtn} onPress={() => handleDeleteAdmin(admin)}>
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
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
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.background,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  orgToggleBtn: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },

  content: { padding: spacing.base, gap: spacing.md },

  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: spacing.md,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
  },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: spacing.md - 2,
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
  },

  adminCard: {
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
  adminAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  adminInitial: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.primary,
  },
  adminName: {
    fontSize: typography.base,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  adminEmail: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  adminPhone: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 1,
  },

  adminActions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: typography.bold,
  },
  iconBtn: {
    width: 28, height: 28,
    justifyContent: 'center', alignItems: 'center',
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
