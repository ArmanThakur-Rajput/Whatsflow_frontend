// ConfirmModal
//
// confirmDialog() is a plain function so it can be called from anywhere
// (event handlers, async functions) without needing to be a component
// itself. To still show a properly styled dialog — instead of the raw,
// unstyled browser window.confirm() — this component is mounted once
// at the app root (see App.tsx) and confirmDialog() reaches it through
// a tiny pub/sub list rather than React state passed down through props.
//
// Android/iOS are untouched — they keep using the real Alert.alert(),
// which already renders a proper native dialog. This component only
// renders/matters on web.
import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

export interface ConfirmModalRequest {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  destructive: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

type Listener = (request: ConfirmModalRequest) => void;
const listeners: Listener[] = [];

export function showConfirmModal(request: ConfirmModalRequest) {
  listeners.forEach((listener) => listener(request));
}

export default function ConfirmModalHost() {
  const [request, setRequest] = useState<ConfirmModalRequest | null>(null);

  useEffect(() => {
    const listener: Listener = (req) => setRequest(req);
    listeners.push(listener);
    return () => {
      const idx = listeners.indexOf(listener);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }, []);

  if (!request) return null;

  const close = () => setRequest(null);

  const handleCancel = () => {
    request.onCancel?.();
    close();
  };

  const handleConfirm = () => {
    request.onConfirm();
    close();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleCancel}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleCancel}
      >
        <View style={styles.card} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>{request.title}</Text>
          <Text style={styles.message}>{request.message}</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelText}>{request.cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, request.destructive && styles.destructiveBtn]}
              onPress={handleConfirm}
            >
              <Text style={[styles.confirmText, request.destructive && styles.destructiveText]}>
                {request.confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
  },
  title: {
    fontSize: typography.lg,
    fontWeight: typography.bold as any,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  message: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  cancelText: {
    fontSize: typography.sm,
    fontWeight: typography.semiBold as any,
    color: colors.textSecondary,
  },
  confirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  confirmText: {
    fontSize: typography.sm,
    fontWeight: typography.semiBold as any,
    color: colors.white,
  },
  destructiveBtn: {
    backgroundColor: '#FEF2F2',
  },
  destructiveText: {
    color: '#EF4444',
  },
});
