// confirmDialog
//
// React Native's Alert.alert() with multiple custom buttons (Cancel +
// a destructive action, each with its own onPress) does not reliably
// work on React Native Web. The browser's underlying primitive is
// window.confirm(), which only supports a plain unstyled OK/Cancel with
// no custom button text and no per-button callbacks — so Alert.alert()
// calls shaped like that across this app (delete, deactivate, logout
// confirmations) were silently no-op on web: tapping the button did
// nothing, no dialog ever appeared.
//
// This helper presents the same "Cancel vs confirm-and-run-a-callback"
// shape on every platform:
//   - Android / iOS: real Alert.alert(), unchanged from before.
//   - Web: a styled in-app modal (ConfirmModalHost, mounted once in
//     App.tsx) so the dialog looks like part of the app instead of the
//     browser's bare, unstyled window.confirm() popup.
//
// Usage mirrors what every call site already had:
//
//   confirmDialog({
//     title: 'Remove Lead',
//     message: `Remove "${lead.name}" from your list?`,
//     confirmText: 'Remove',
//     destructive: true,
//     onConfirm: async () => { await softDeleteLead(leadId); },
//   });
import { Alert, Platform } from 'react-native';
import { showConfirmModal } from '../components/common/ConfirmModal';

interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export function confirmDialog({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogOptions) {
  if (Platform.OS === 'web') {
    showConfirmModal({
      title,
      message,
      confirmText,
      cancelText,
      destructive,
      onConfirm,
      onCancel,
    });
    return;
  }

  Alert.alert(title, message, [
    { text: cancelText, style: 'cancel', onPress: onCancel },
    {
      text: confirmText,
      style: destructive ? 'destructive' : 'default',
      onPress: onConfirm,
    },
  ]);
}

