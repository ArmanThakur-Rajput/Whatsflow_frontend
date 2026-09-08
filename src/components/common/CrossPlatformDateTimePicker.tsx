// CrossPlatformDateTimePicker
//
// @react-native-community/datetimepicker only ships real native UI for
// Android + iOS. On web it renders nothing usable, which is why every
// screen that opened a raw <DateTimePicker /> (AddFollowUpScreen,
// BookAppointmentScreen, LeadDetailScreen) silently did nothing when
// tapped in a browser.
//
// This wrapper keeps the existing native behaviour identical on
// Android/iOS (inline picker on Android, bottom-sheet "Done" modal on
// iOS) and adds a real Web implementation using the native HTML
// <input type="date" /> / <input type="time" /> element via
// react-native-web's interop, which every modern desktop and mobile
// browser already renders responsively.
//
// Usage is intentionally close to the original component's API so call
// sites only need an import swap:
//
//   <CrossPlatformDateTimePicker
//     visible={showDatePicker}
//     value={date}
//     mode="date"
//     minimumDate={new Date()}
//     onChange={(selected) => { setDate(selected); }}
//     onClose={() => setShowDatePicker(false)}
//   />

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

// @react-native-community/datetimepicker officially supports iOS,
// Android, and Windows only — web is not a target platform for the
// native module. Loading it with a static top-level import risks the
// web bundle trying to resolve native-only internals. Since this
// component's web branch (below) never touches the native picker at
// all, the import is deferred to a plain require gated behind a
// platform check, so the web bundle never evaluates it.
let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}

type Mode = 'date' | 'time';

interface Props {
  visible: boolean;
  value: Date;
  mode: Mode;
  title?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  onChange: (selected: Date) => void;
  onClose: () => void;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

// Date <-> "YYYY-MM-DD" using LOCAL calendar fields (never toISOString,
// which shifts the date across midnight in timezones ahead of UTC, e.g.
// IST — see the note in AddFollowUpScreen for the bug this caused before).
function toDateInputValue(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Date <-> "HH:MM" (24h, what <input type="time"> expects/returns)
function toTimeInputValue(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CrossPlatformDateTimePicker({
  visible,
  value,
  mode,
  title,
  minimumDate,
  maximumDate,
  onChange,
  onClose,
}: Props) {
  if (!visible) return null;

  // ── Web: native HTML date/time input, rendered inside a small
  // centered card so it looks intentional rather than a bare browser
  // control floating on the page. Confirms immediately on change,
  // matching the Android "pick and done" feel rather than iOS's
  // separate Done button (there's no concept of an OS-level cancel
  // sheet on web, so immediate-apply is the least surprising choice). ──
  if (Platform.OS === 'web') {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={webStyles.overlay}>
          <View style={webStyles.card}>
            <View style={webStyles.header}>
              <Text style={webStyles.title}>{title || (mode === 'date' ? 'Select date' : 'Select time')}</Text>
              <TouchableOpacity onPress={onClose} style={webStyles.closeBtn} accessibilityLabel="Close">
                <Text style={webStyles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {React.createElement('input', {
              type: mode === 'date' ? 'date' : 'time',
              value: mode === 'date' ? toDateInputValue(value) : toTimeInputValue(value),
              min: mode === 'date' && minimumDate ? toDateInputValue(minimumDate) : undefined,
              max: mode === 'date' && maximumDate ? toDateInputValue(maximumDate) : undefined,
              style: inputStyle,
              autoFocus: true,
              onChange: (e: any) => {
                const raw = e.target.value;
                if (!raw) return;
                const next = new Date(value);
                if (mode === 'date') {
                  const [y, m, d] = raw.split('-').map(Number);
                  next.setFullYear(y, m - 1, d);
                } else {
                  const [h, min] = raw.split(':').map(Number);
                  next.setHours(h, min, 0, 0);
                }
                onChange(next);
              },
            })}

            <TouchableOpacity style={webStyles.doneBtn} onPress={onClose}>
              <Text style={webStyles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Android: native inline picker that closes itself on pick/dismiss ──
  if (Platform.OS === 'android') {
    return (
      <DateTimePicker
        value={value}
        mode={mode}
        display="default"
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        onChange={(_event: any, selected?: Date) => {
          onClose();
          if (selected) onChange(selected);
        }}
      />
    );
  }

  // ── iOS: spinner inside a bottom-sheet modal with an explicit Done
  // button, since iOS has no implicit dismiss-on-pick gesture ──
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={iosStyles.overlay}>
        <View style={iosStyles.sheet}>
          <View style={iosStyles.header}>
            <Text style={iosStyles.title}>{title || (mode === 'date' ? 'Select Date' : 'Select Time')}</Text>
            <TouchableOpacity onPress={onClose} style={iosStyles.doneBtn}>
              <Text style={iosStyles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={value}
            mode={mode}
            display="spinner"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={(_event: any, selected?: Date) => {
              if (selected) onChange(selected);
            }}
            style={{ height: 200 }}
          />
        </View>
      </View>
    </Modal>
  );
}

// Plain CSS-in-JS object (not StyleSheet) since this targets a raw DOM
// <input>, not an RN View.
const inputStyle: any = {
  width: '100%',
  fontSize: 16,
  padding: '12px 14px',
  borderRadius: 10,
  border: `1.5px solid ${colors.border}`,
  outline: 'none',
  color: colors.textPrimary,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const webStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 20,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: typography.md, fontWeight: typography.semiBold as any, color: colors.textPrimary },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 16, color: colors.textSecondary },
  doneBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneText: { color: colors.white, fontWeight: typography.bold as any, fontSize: 15 },
});

const iosStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: { fontSize: 16, fontWeight: '600' as any, color: colors.textPrimary },
  doneBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primary + '15',
    borderRadius: 8,
  },
  doneText: { color: colors.primary, fontWeight: '700' as any, fontSize: 15 },
});
