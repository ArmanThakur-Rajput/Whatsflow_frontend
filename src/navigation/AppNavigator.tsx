import React, { useEffect, useState } from 'react';
import { enableScreens } from 'react-native-screens';

enableScreens();
import { NavigationContainer } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import {
  View, Text, StyleSheet, ActivityIndicator,
  BackHandler, Modal, TouchableOpacity,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import AuthNavigator from './AuthNavigator';
import EmployeeNavigator from './EmployeeNavigator';
import AdminNavigator from './AdminNavigator';
import SuperAdminNavigator from './SuperAdminNavigator';
import { colors } from '../theme/colors';

// ─── Foreground notification handler ─────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─────────────────────────────────────────────
// Exit Confirmation Modal
// ─────────────────────────────────────────────
function ExitModal({ visible, onConfirm, onCancel }: {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Text style={styles.iconText}>👋</Text>
          </View>
          <Text style={styles.title}>Exit App?</Text>
          <Text style={styles.message}>Are you sure you want to exit?</Text>
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm} activeOpacity={0.8}>
              <Text style={styles.confirmText}>Exit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// AppNavigator
// ─────────────────────────────────────────────
export default function AppNavigator({ navigationRef }: { navigationRef: React.RefObject<any> }) {
  const { isAuthenticated, isLoading, loadStoredAuth, user } = useAuthStore();
  const [showExitModal, setShowExitModal] = useState(false);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  // ── Notification tap → lead detail navigate ──────────────────────────────
  useEffect(() => {
    // App foreground mein hai aur notification tap kiya
    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      const leadId = data?.leadId;
      if (!leadId || !navigationRef?.current) return;

      // Role ke hisab se sahi screen pe navigate karo
      if (user?.role === 'admin') {
        navigationRef.current.navigate('AdminLeadDetail', { leadId });
      } else if (user?.role === 'employee') {
        navigationRef.current.navigate('LeadDetail', { leadId });
      }
    });

    return () => tapSub.remove();
  }, [user]);

  // ── Android hardware back button ─────────────────────────────────────────
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const nav = navigationRef?.current;
      if (nav && nav.canGoBack()) return false;
      setShowExitModal(true);
      return true;
    });
    return () => sub.remove();
  }, [navigationRef]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <NavigationContainer ref={navigationRef}>
        {!isAuthenticated ? (
          <AuthNavigator />
        ) : user?.role === 'superadmin' ? (
          <SuperAdminNavigator />
        ) : user?.role === 'admin' ? (
          <AdminNavigator />
        ) : (
          <EmployeeNavigator />
        )}
      </NavigationContainer>

      <ExitModal
        visible={showExitModal}
        onCancel={() => setShowExitModal(false)}
        onConfirm={() => BackHandler.exitApp()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32,
  },
  card: {
    backgroundColor: colors.white, borderRadius: 20, padding: 28,
    width: '100%', alignItems: 'center', elevation: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  iconText: { fontSize: 32 },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  message: {
    fontSize: 15, color: colors.textSecondary,
    textAlign: 'center', lineHeight: 22, marginBottom: 28,
  },
  btnRow: { flexDirection: 'row', gap: 12, width: '100%' },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.border, alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  confirmBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#EF4444', alignItems: 'center',
  },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
