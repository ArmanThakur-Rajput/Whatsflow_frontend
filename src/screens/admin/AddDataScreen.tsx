import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';
import axiosInstance from '../../api/axiosInstance';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ImportError {
  row: number;
  name?: string;
  reason: string;
}

interface ImportSummary {
  total: number;
  imported: number;
  skipped: number;
  errors: ImportError[];
}

// ─── Result card ──────────────────────────────────────────────────────────────
function ResultCard({ summary }: { summary: ImportSummary }) {
  const [showErrors, setShowErrors] = useState(false);
  const allGood = summary.skipped === 0;

  return (
    <View style={rs.card}>
      <Text style={rs.heading}>Import Complete</Text>

      <View style={rs.statsRow}>
        <View style={rs.stat}>
          <Text style={rs.statNum}>{summary.total}</Text>
          <Text style={rs.statLabel}>Total Rows</Text>
        </View>
        <View style={[rs.stat, rs.statGreen]}>
          <Text style={[rs.statNum, { color: colors.success }]}>{summary.imported}</Text>
          <Text style={rs.statLabel}>Imported ✓</Text>
        </View>
        <View style={[rs.stat, summary.skipped > 0 && rs.statRed]}>
          <Text style={[rs.statNum, summary.skipped > 0 && { color: colors.error }]}>
            {summary.skipped}
          </Text>
          <Text style={rs.statLabel}>Skipped</Text>
        </View>
      </View>

      {allGood ? (
        <View style={rs.successBanner}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={rs.successText}>All rows imported successfully!</Text>
        </View>
      ) : (
        <>
          <TouchableOpacity
            style={rs.errorToggle}
            onPress={() => setShowErrors((p) => !p)}
          >
            <Ionicons
              name={showErrors ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.error}
            />
            <Text style={rs.errorToggleText}>
              {showErrors ? 'Hide' : 'Show'} {summary.skipped} skipped row{summary.skipped > 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>

          {showErrors &&
            summary.errors.map((e, idx) => (
              <View key={idx} style={rs.errorRow}>
                <View style={rs.errorBadge}>
                  <Text style={rs.errorBadgeText}>Row {e.row}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  {e.name ? <Text style={rs.errorName}>{e.name}</Text> : null}
                  <Text style={rs.errorReason}>{e.reason}</Text>
                </View>
              </View>
            ))}
        </>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function AddDataScreen() {
  const navigation = useNavigation<any>();
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pickedFileName, setPickedFileName] = useState<string | null>(null);
  const [pickedFileUri, setPickedFileUri] = useState<string | null>(null);
  const [pickedFileBlob, setPickedFileBlob] = useState<Blob | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  // ── Download template ─────────────────────────────────────────────────────
  // Platform.OS === 'web'  → fetch + anchor click (browser native download)
  // Platform.OS === 'android'/'ios' → expo-file-system v54 File API + Sharing
  const handleDownloadTemplate = async () => {
    setDownloading(true);
    try {
      const { storage } = await import('../../utils/storage');
      const token = await storage.getToken();
      const url = axiosInstance.defaults.baseURL + '/leads/import/template';

      if (Platform.OS === 'web') {
        // ── Web: browser fetch → Blob → anchor download ──────────────────
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Server returned ' + response.status);

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = 'leads_template.csv';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(objectUrl);

        Toast.show({ type: 'success', text1: 'Template downloaded!' });

      } else {
        // ── Android / iOS: expo-file-system v54 File API ─────────────────
        const { File, Paths } = await import('expo-file-system');

        const destination = new File(Paths.cache, 'leads_template.csv');
        if (destination.exists) destination.delete();

        const downloaded = await File.downloadFileAsync(url, Paths.cache, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloaded.uri, {
            mimeType: 'text/csv',
            dialogTitle: 'Save Leads Template',
            UTI: 'public.comma-separated-values-text',
          });
        } else {
          Toast.show({ type: 'success', text1: 'Template saved!' });
        }
      }
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Download failed',
        text2: err?.message || 'Something went wrong',
      });
    } finally {
      setDownloading(false);
    }
  };

  // ── Pick CSV file ─────────────────────────────────────────────────────────
  // Web: <input type="file"> since DocumentPicker doesn't work reliably on web
  // Android/iOS: expo-document-picker
  const handlePickFile = async () => {
    setSummary(null);

    if (Platform.OS === 'web') {
      // Web: hidden file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv,text/csv';
      input.onchange = async (e: any) => {
        const file: File = e.target.files?.[0];
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.csv')) {
          Toast.show({ type: 'error', text1: 'Only CSV files are allowed' });
          return;
        }
        setPickedFileName(file.name);
        setPickedFileBlob(file);
        setPickedFileUri('web-blob');
      };
      input.click();
      return;
    }

    // Android / iOS
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      if (!asset.name.toLowerCase().endsWith('.csv')) {
        Toast.show({ type: 'error', text1: 'Only CSV files are allowed' });
        return;
      }

      setPickedFileName(asset.name);
      setPickedFileUri(asset.uri);
      setPickedFileBlob(null);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Could not open file picker' });
    }
  };

  // ── Upload & import ───────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!pickedFileUri || !pickedFileName) return;

    setUploading(true);
    setSummary(null);
    try {
      const formData = new FormData();

      if (Platform.OS === 'web' && pickedFileBlob) {
        // Web: append Blob directly
        formData.append('file', pickedFileBlob, pickedFileName);
      } else {
        // Android / iOS: append with uri
        formData.append('file', {
          uri: pickedFileUri,
          name: pickedFileName,
          type: 'text/csv',
        } as any);
      }

      const res = await axiosInstance.post('/leads/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSummary(res.data.summary);
      setPickedFileName(null);
      setPickedFileUri(null);
      setPickedFileBlob(null);

      if (res.data.summary.imported > 0) {
        Toast.show({
          type: 'success',
          text1: `${res.data.summary.imported} lead${res.data.summary.imported > 1 ? 's' : ''} imported!`,
          text2: res.data.summary.skipped > 0
            ? `${res.data.summary.skipped} row${res.data.summary.skipped > 1 ? 's' : ''} skipped`
            : 'All rows processed successfully',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'No leads imported',
          text2: 'All rows had errors — check the details below',
        });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || 'Upload failed';
      Toast.show({ type: 'error', text1: 'Import failed', text2: msg });
    } finally {
      setUploading(false);
    }
  };

  const hasFile = !!pickedFileUri;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Data</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Step 1 — Download template */}
        <View style={styles.stepCard}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepNum}>1</Text>
          </View>
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle}>Download Template</Text>
            <Text style={styles.stepDesc}>
              Get a CSV template with columns matching your custom fields. Fill it with your leads data and save it.
            </Text>
            <TouchableOpacity
              style={[styles.btn, styles.btnOutline, downloading && styles.btnDisabled]}
              onPress={handleDownloadTemplate}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="download-outline" size={18} color={colors.primary} />
              )}
              <Text style={styles.btnOutlineText}>
                {downloading ? 'Downloading…' : 'Download Template'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Step 2 — Fill template note */}
        <View style={styles.stepCard}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepNum}>2</Text>
          </View>
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle}>Fill in Your Data</Text>
            <Text style={styles.stepDesc}>
              Open the template in Excel or Google Sheets. Fill each row with lead information. Do not change the column headers.
            </Text>
            <View style={styles.tipBox}>
              <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
              <Text style={styles.tipText}>
                Duplicate phone numbers and invalid values will be skipped automatically — you'll see a report after upload.
              </Text>
            </View>
          </View>
        </View>

        {/* Step 3 — Upload */}
        <View style={styles.stepCard}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepNum}>3</Text>
          </View>
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle}>Upload CSV</Text>
            <Text style={styles.stepDesc}>
              Select your filled CSV file. Leads will be automatically distributed to your team.
            </Text>

            {/* File picker area */}
            <TouchableOpacity
              style={[styles.filePicker, hasFile && styles.filePickerActive]}
              onPress={handlePickFile}
              disabled={uploading}
            >
              <Ionicons
                name={hasFile ? 'document-text' : 'cloud-upload-outline'}
                size={28}
                color={hasFile ? colors.success : colors.textLight}
              />
              <Text style={[styles.filePickerText, hasFile && { color: colors.success }]}>
                {hasFile ? pickedFileName : 'Tap to select CSV file'}
              </Text>
              {hasFile && (
                <TouchableOpacity onPress={() => {
                  setPickedFileName(null);
                  setPickedFileUri(null);
                  setPickedFileBlob(null);
                }}>
                  <Ionicons name="close-circle" size={20} color={colors.textLight} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {/* Upload button */}
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, (!hasFile || uploading) && styles.btnDisabled]}
              onPress={handleUpload}
              disabled={!hasFile || uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons name="arrow-up-circle-outline" size={18} color={colors.white} />
              )}
              <Text style={styles.btnPrimaryText}>
                {uploading ? 'Importing…' : 'Import Leads'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Result summary */}
        {summary && <ResultCard summary={summary} />}

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.base, paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.background,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.lg, fontWeight: typography.bold, color: colors.textPrimary,
  },

  content: { padding: spacing.base, gap: spacing.md },

  stepCard: {
    backgroundColor: colors.white, borderRadius: 16,
    padding: spacing.base, flexDirection: 'row', gap: spacing.md,
    elevation: 1, shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  stepBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 2,
  },
  stepNum: { fontSize: typography.sm, fontWeight: typography.bold, color: colors.white },
  stepBody: { flex: 1, gap: spacing.sm },
  stepTitle: { fontSize: typography.base, fontWeight: typography.bold, color: colors.textPrimary },
  stepDesc: { fontSize: typography.sm, color: colors.textSecondary, lineHeight: 20 },

  tipBox: {
    flexDirection: 'row', gap: spacing.xs,
    backgroundColor: colors.primaryLight, borderRadius: 10,
    padding: spacing.sm, alignItems: 'flex-start',
  },
  tipText: { flex: 1, fontSize: typography.xs, color: colors.primary, lineHeight: 17 },

  filePicker: {
    borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed',
    borderRadius: 12, padding: spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.background,
  },
  filePickerActive: { borderColor: colors.success, borderStyle: 'solid', backgroundColor: colors.success + '0A' },
  filePickerText: { flex: 1, fontSize: typography.sm, color: colors.textLight },

  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, borderRadius: 12, paddingVertical: spacing.md,
  },
  btnOutline: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.white },
  btnOutlineText: { fontSize: typography.base, fontWeight: typography.semiBold, color: colors.primary },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { fontSize: typography.base, fontWeight: typography.bold, color: colors.white },
  btnDisabled: { opacity: 0.5 },
});

// Result card styles
const rs = StyleSheet.create({
  card: {
    backgroundColor: colors.white, borderRadius: 16,
    padding: spacing.base, gap: spacing.md,
    elevation: 1, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  heading: { fontSize: typography.md, fontWeight: typography.bold, color: colors.textPrimary },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1, alignItems: 'center',
    backgroundColor: colors.background, borderRadius: 12, padding: spacing.sm,
  },
  statGreen: { backgroundColor: colors.success + '12' },
  statRed: { backgroundColor: colors.error + '10' },
  statNum: { fontSize: typography.xl, fontWeight: typography.bold, color: colors.textPrimary },
  statLabel: { fontSize: typography.xs, color: colors.textSecondary, marginTop: 2 },

  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.success + '12', borderRadius: 10, padding: spacing.sm,
  },
  successText: { fontSize: typography.sm, fontWeight: typography.semiBold, color: colors.success },

  errorToggle: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  errorToggleText: { fontSize: typography.sm, fontWeight: typography.semiBold, color: colors.error },

  errorRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: 1, borderTopColor: colors.borderLight,
  },
  errorBadge: {
    backgroundColor: colors.error + '15', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  errorBadgeText: { fontSize: typography.xs, color: colors.error, fontWeight: typography.semiBold },
  errorName: { fontSize: typography.sm, fontWeight: typography.semiBold, color: colors.textPrimary },
  errorReason: { fontSize: typography.xs, color: colors.textSecondary },
});
