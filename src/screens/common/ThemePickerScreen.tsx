import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useThemeStore, THEME_PRESETS } from '../../store/themeStore';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

export default function ThemePickerScreen() {
  const navigation = useNavigation<any>();
  const { activeThemeId, theme, setTheme } = useThemeStore();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.white, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: theme.background }]}>
          <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>App Theme</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Choose a color theme for your app. This applies to both admin and employee views and is saved on this device.
        </Text>

        <View style={styles.grid}>
          {THEME_PRESETS.map((preset) => {
            const isActive = activeThemeId === preset.id;
            const isDark = preset.id === 'dark';
            return (
              <TouchableOpacity
                key={preset.id}
                style={[
                  styles.card,
                  { backgroundColor: theme.white, borderColor: isActive ? preset.primary : theme.border },
                  isActive && { borderWidth: 2.5 },
                ]}
                onPress={() => setTheme(preset.id)}
                activeOpacity={0.8}
              >
                {/* Preview swatch */}
                <View style={[styles.swatch, { backgroundColor: preset.background }]}>
                  {/* Fake header bar */}
                  <View style={[styles.fakeHeader, { backgroundColor: preset.white, borderBottomColor: preset.border }]}>
                    <View style={[styles.fakeDot, { backgroundColor: preset.primary }]} />
                    <View style={[styles.fakeLine, { backgroundColor: preset.border, width: 40 }]} />
                  </View>
                  {/* Fake card */}
                  <View style={[styles.fakeCard, { backgroundColor: preset.white, borderColor: preset.border }]}>
                    <View style={[styles.fakeAvatar, { backgroundColor: preset.primaryLight }]}>
                      <View style={[styles.fakeAvatarDot, { backgroundColor: preset.primary }]} />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={[styles.fakeLine, { backgroundColor: preset.textSecondary + '40', width: '70%' }]} />
                      <View style={[styles.fakeLine, { backgroundColor: preset.border, width: '50%' }]} />
                    </View>
                  </View>
                  {/* Fake button */}
                  <View style={[styles.fakeBtn, { backgroundColor: preset.primary }]} />
                </View>

                {/* Label row */}
                <View style={styles.labelRow}>
                  <View style={[styles.colorDot, { backgroundColor: preset.primary }]} />
                  <Text style={[styles.presetName, { color: theme.textPrimary }]}>{preset.name}</Text>
                  {isActive && (
                    <Ionicons name="checkmark-circle" size={18} color={preset.primary} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  content: {
    padding: spacing.base,
  },
  subtitle: {
    fontSize: typography.sm,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    width: '47%',
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  swatch: {
    height: 110,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  fakeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  fakeDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  fakeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
  fakeAvatar: {
    width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },
  fakeAvatarDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  fakeLine: {
    height: 5, borderRadius: 3,
  },
  fakeBtn: {
    height: 14,
    borderRadius: 7,
    marginTop: 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  colorDot: {
    width: 10, height: 10, borderRadius: 5,
  },
  presetName: {
    flex: 1,
    fontSize: typography.sm,
    fontWeight: typography.semiBold,
  },
});
