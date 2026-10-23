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
interface ImportError { row: number; name?: string; reason: string; }
interface ImportSummary { total: number; imported: number; skipped: number; errors: ImportError[]; }


// ─── Price normalizer ─────────────────────────────────────────────────────────
// Accepts: 45000 | 45,000 | 45k | 4.5L | 4.5 L | 45000 (45k) | 1.2Cr etc.
// Returns: "45000 (45k)" formatted string, or original if unparseable
function normalizePrice(raw: string): string {
  if (!raw || !raw.trim()) return '';
  const s = raw.trim();
  // Strip existing short form like "45000 (45k)" -> "45000"
  const stripped = s.replace(/\s*\(.*?\)\s*$/, '').trim();

  let num: number | null = null;
  const match = stripped.replace(/,/g, '').match(
    /^([\d.]+)\s*(k|K|l|L|lac|lakh|Lac|Lakh|cr|Cr|crore|Crore)?$/i
  );
  if (match) {
    const base = parseFloat(match[1]);
    const unit = (match[2] || '').toLowerCase();
    if (!isNaN(base)) {
      if (unit === 'k') num = base * 1_000;
      else if (['l', 'lac', 'lakh'].includes(unit)) num = base * 100_000;
      else if (['cr', 'crore'].includes(unit)) num = base * 10_000_000;
      else num = base;
    }
  }
  if (num === null || isNaN(num) || num === 0) return s;

  let short = '';
  if (num >= 10_000_000) short = `${(num / 10_000_000).toFixed(2).replace(/\.?0+$/, '')} Cr`;
  else if (num >= 100_000) short = `${(num / 100_000).toFixed(2).replace(/\.?0+$/, '')} L`;
  else if (num >= 1_000) short = `${(num / 1_000).toFixed(1).replace(/\.?0+$/, '')}k`;

  const rawInt = Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.?0+$/, '');
  return short ? `${rawInt} (${short})` : rawInt;
}

// ─── CSV price normalizer ─────────────────────────────────────────────────────
function normalizePriceInCsv(csvText: string): string {
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) return csvText;

  const parseRow = (line: string): string[] => {
    const cols: string[] = [];
    let inQuote = false;
    let cur = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { cols.push(cur); cur = ''; }
      else { cur += ch; }
    }
    cols.push(cur);
    return cols;
  };

  const quoteIfNeeded = (val: string): string =>
    val.includes(',') || val.includes('"') || val.includes('\n')
      ? `"${val.replace(/"/g, '""')}"` : val;

  const headers = parseRow(lines[0]);
  const priceIdx = headers.findIndex((h) => h.trim().toLowerCase() === 'price');
  if (priceIdx === -1) return csvText;

  const result = [lines[0]];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { result.push(line); continue; }
    const cols = parseRow(line);
    if (cols[priceIdx] !== undefined) {
      cols[priceIdx] = normalizePrice(cols[priceIdx]);
    }
    result.push(cols.map(quoteIfNeeded).join(','));
  }
  return result.join('\n');
}

// ─── Result card ──────────────────────────────────────────────────────────────
function ResultCard({ summary }: { summary: ImportSummary }) {
  const [showErrors, setShowErrors] = useState(false);
  const allGood = summary.skipped === 0;
  return (
    <View style={rs.card}>
      <Text style={rs.heading}>Import Complete</Text>
      <View style={rs.statsRow}>
        <View style={rs.stat}><Text style={rs.statNum}>{summary.total}</Text><Text style={rs.statLabel}>Total Rows</Text></View>
        <View style={[rs.stat, rs.statGreen]}><Text style={[rs.statNum, { color: colors.success }]}>{summary.imported}</Text><Text style={rs.statLabel}>Imported ✓</Text></View>
        <View style={[rs.stat, summary.skipped > 0 && rs.statRed]}><Text style={[rs.statNum, summary.skipped > 0 && { color: colors.error }]}>{summary.skipped}</Text><Text style={rs.statLabel}>Skipped</Text></View>
      </View>
      {allGood ? (
        <View style={rs.successBanner}><Ionicons name="checkmark-circle" size={20} color={colors.success} /><Text style={rs.successText}>All rows imported successfully!</Text></View>
      ) : (
        <>
          <TouchableOpacity style={rs.errorToggle} onPress={() => setShowErrors((p) => !p)}>
            <Ionicons name={showErrors ? 'chevron-up' : 'chevron-down'} size={16} color={colors.error} />
            <Text style={rs.errorToggleText}>{showErrors ? 'Hide' : 'Show'} {summary.skipped} skipped row{summary.skipped > 1 ? 's' : ''}</Text>
          </TouchableOpacity>
          {showErrors && summary.errors.map((e, idx) => (
            <View key={idx} style={rs.errorRow}>
              <View style={rs.errorBadge}><Text style={rs.errorBadgeText}>Row {e.row}</Text></View>
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

// ─── Shared import/export panel ────────────────────────────────────────────────
function ImportPanel({
  type,
}: {
  type: 'leads' | 'properties';
}) {
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pickedFileName, setPickedFileName] = useState<string | null>(null);
  const [pickedFileUri, setPickedFileUri] = useState<string | null>(null);
  const [pickedFileBlob, setPickedFileBlob] = useState<Blob | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const templateUrl = type === 'leads' ? '/leads/import/template' : '/property-crm/import/template';
  const importUrl = type === 'leads' ? '/leads/import' : '/property-crm/import';
  const exportUrl = type === 'properties' ? '/property-crm/export' : null;
  const templateName = type === 'leads' ? 'leads_template.csv' : 'properties_template.csv';
  const entityLabel = type === 'leads' ? 'Leads' : 'Properties';

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    try {
      const { storage } = await import('../../utils/storage');
      const token = await storage.getToken();
      const url = axiosInstance.defaults.baseURL + templateUrl;

      if (Platform.OS === 'web') {
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error('Server returned ' + response.status);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = templateName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(objectUrl);
        Toast.show({ type: 'success', text1: 'Template downloaded!' });
      } else {
        const FileSystem = await import('expo-file-system/legacy');
        const fileUri = FileSystem.cacheDirectory + templateName;
        const downloadRes = await FileSystem.downloadAsync(url, fileUri, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadRes.uri, {
            mimeType: 'text/csv',
            dialogTitle: `Save ${entityLabel} Template`,
            UTI: 'public.comma-separated-values-text',
          });
        } else {
          Toast.show({ type: 'success', text1: 'Template saved!' });
        }
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Download failed', text2: err?.message || 'Something went wrong' });
    } finally {
      setDownloading(false);
    }
  };

  const handlePickFile = async () => {
    setSummary(null);
    if (Platform.OS === 'web') {
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
    } catch {
      Toast.show({ type: 'error', text1: 'Could not open file picker' });
    }
  };

  const handleUpload = async () => {
    if (!pickedFileUri || !pickedFileName) return;
    setUploading(true);
    setSummary(null);
    try {
      const formData = new FormData();
      // For properties CSV, normalize price column before uploading
      const shouldNormalizePrice = type === 'properties';
      if (Platform.OS === 'web' && pickedFileBlob) {
        if (shouldNormalizePrice) {
          const rawText = await pickedFileBlob.text();
          const normalized = normalizePriceInCsv(rawText);
          const normalizedBlob = new Blob([normalized], { type: 'text/csv' });
          formData.append('file', normalizedBlob, pickedFileName);
        } else {
          formData.append('file', pickedFileBlob, pickedFileName);
        }
      } else {
        if (shouldNormalizePrice) {
          const FileSystem = await import('expo-file-system/legacy');
          const rawText = await FileSystem.readAsStringAsync(pickedFileUri, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          const normalized = normalizePriceInCsv(rawText);
          const tempUri = (FileSystem.cacheDirectory ?? '') + 'normalized_' + pickedFileName;
          await FileSystem.writeAsStringAsync(tempUri, normalized, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          formData.append('file', { uri: tempUri, name: pickedFileName, type: 'text/csv' } as any);
        } else {
          formData.append('file', { uri: pickedFileUri, name: pickedFileName, type: 'text/csv' } as any);
        }
      }
      const res = await axiosInstance.post(importUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSummary(res.data.summary);
      setPickedFileName(null);
      setPickedFileUri(null);
      setPickedFileBlob(null);
      if (res.data.summary.imported > 0) {
        Toast.show({
          type: 'success',
          text1: `${res.data.summary.imported} ${entityLabel.toLowerCase()} imported!`,
          text2: res.data.summary.skipped > 0 ? `${res.data.summary.skipped} row(s) skipped` : 'All rows processed',
        });
      } else {
        Toast.show({ type: 'error', text1: 'No data imported', text2: 'All rows had errors — check details below' });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Import failed', text2: err?.response?.data?.message || err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleExport = async () => {
    if (!exportUrl) return;
    setExporting(true);
    try {
      const { storage } = await import('../../utils/storage');
      const token = await storage.getToken();
      const url = axiosInstance.defaults.baseURL + exportUrl;

      if (Platform.OS === 'web') {
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error('Export failed');
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = 'properties_export.csv';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(objectUrl);
      } else {
        const FileSystem = await import('expo-file-system/legacy');
        const fileUri = FileSystem.cacheDirectory + 'properties_export.csv';
        const downloadRes = await FileSystem.downloadAsync(url, fileUri, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadRes.uri, { mimeType: 'text/csv', dialogTitle: 'Save Properties Export' });
        }
      }
      Toast.show({ type: 'success', text1: 'Properties exported!' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Export failed', text2: err?.message });
    } finally {
      setExporting(false);
    }
  };

  const hasFile = !!pickedFileUri;

  const tipText = type === 'leads'
    ? 'Duplicate phone numbers and invalid values will be skipped automatically.'
    : 'Amenities should be semicolon-separated (e.g. Pool;Gym;Security).\n\n• intent must be "rent" or "buy"\n• Flat → flatConfig required (1RK, 1BHK, 2BHK, 3BHK, 4BHK, 4BHK+)\n• Plot → plotArea required (in sqft)\n• Rows missing projectName, intent, propertyType or location are skipped';

  return (
    <View style={styles.panelContent}>
      {/* Step 1 */}
      <View style={styles.stepCard}>
        <View style={styles.stepBadge}><Text style={styles.stepNum}>1</Text></View>
        <View style={styles.stepBody}>
          <Text style={styles.stepTitle}>Download Template</Text>
          <Text style={styles.stepDesc}>
            Get a CSV template with all required columns for {entityLabel.toLowerCase()}.
          </Text>
          <TouchableOpacity
            style={[styles.btn, styles.btnOutline, downloading && styles.btnDisabled]}
            onPress={handleDownloadTemplate}
            disabled={downloading}
          >
            {downloading ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="download-outline" size={18} color={colors.primary} />}
            <Text style={styles.btnOutlineText}>{downloading ? 'Downloading…' : 'Download Template'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Step 2 */}
      <View style={styles.stepCard}>
        <View style={styles.stepBadge}><Text style={styles.stepNum}>2</Text></View>
        <View style={styles.stepBody}>
          <Text style={styles.stepTitle}>Fill in Your Data</Text>
          <Text style={styles.stepDesc}>
            Open the template in Excel or Google Sheets. Fill each row with data. Do not change the column headers.
          </Text>
          <View style={styles.tipBox}>
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.tipText}>{tipText}</Text>
          </View>
        </View>
      </View>

      {/* Step 3 */}
      <View style={styles.stepCard}>
        <View style={styles.stepBadge}><Text style={styles.stepNum}>3</Text></View>
        <View style={styles.stepBody}>
          <Text style={styles.stepTitle}>Upload CSV</Text>
          <Text style={styles.stepDesc}>Select your filled CSV file to import {entityLabel.toLowerCase()}.</Text>
          <TouchableOpacity
            style={[styles.filePicker, hasFile && styles.filePickerActive]}
            onPress={handlePickFile}
            disabled={uploading}
          >
            <Ionicons name={hasFile ? 'document-text' : 'cloud-upload-outline'} size={28} color={hasFile ? colors.success : colors.textLight} />
            <Text style={[styles.filePickerText, hasFile && { color: colors.success }]}>
              {hasFile ? pickedFileName : 'Tap to select CSV file'}
            </Text>
            {hasFile && (
              <TouchableOpacity onPress={() => { setPickedFileName(null); setPickedFileUri(null); setPickedFileBlob(null); }}>
                <Ionicons name="close-circle" size={20} color={colors.textLight} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, (!hasFile || uploading) && styles.btnDisabled]}
            onPress={handleUpload}
            disabled={!hasFile || uploading}
          >
            {uploading ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="arrow-up-circle-outline" size={18} color={colors.white} />}
            <Text style={styles.btnPrimaryText}>{uploading ? 'Importing…' : `Import ${entityLabel}`}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {summary && <ResultCard summary={summary} />}
      <View style={{ height: spacing.xxxl }} />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AddDataScreen() {
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<'leads' | 'properties'>('leads');

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

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'leads' && styles.tabActive]}
          onPress={() => setActiveTab('leads')}
        >
          <Ionicons
            name={activeTab === 'leads' ? 'person' : 'person-outline'}
            size={16}
            color={activeTab === 'leads' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'leads' && styles.tabTextActive]}>Add Leads</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'properties' && styles.tabActive]}
          onPress={() => setActiveTab('properties')}
        >
          <Ionicons
            name={activeTab === 'properties' ? 'home' : 'home-outline'}
            size={16}
            color={activeTab === 'properties' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'properties' && styles.tabTextActive]}>Add Properties</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <ImportPanel type={activeTab} />
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
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.textPrimary },

  tabBar: {
    flexDirection: 'row', backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, paddingVertical: spacing.md,
    borderBottomWidth: 2.5, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: typography.sm, fontWeight: typography.semiBold, color: colors.textSecondary },
  tabTextActive: { color: colors.primary },

  panelContent: { padding: spacing.base, gap: spacing.md },

  btnExport: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, borderRadius: 12, paddingVertical: spacing.md,
    backgroundColor: '#059669' + '12',
    borderWidth: 1.5, borderColor: '#059669',
  },
  btnExportText: { fontSize: typography.base, fontWeight: typography.semiBold, color: '#059669' },

  stepCard: {
    backgroundColor: colors.white, borderRadius: 16,
    padding: spacing.base, flexDirection: 'row', gap: spacing.md,
    elevation: 1, shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  stepBadge: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center', marginTop: 2,
  },
  stepNum: { fontSize: typography.sm, fontWeight: typography.bold, color: colors.white },
  stepBody: { flex: 1, gap: spacing.sm },
  stepTitle: { fontSize: typography.base, fontWeight: typography.bold, color: colors.textPrimary },
  stepDesc: { fontSize: typography.sm, color: colors.textSecondary, lineHeight: 20 },
  tipBox: {
    flexDirection: 'row', gap: spacing.xs, backgroundColor: colors.primaryLight,
    borderRadius: 10, padding: spacing.sm, alignItems: 'flex-start',
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

const rs = StyleSheet.create({
  card: {
    backgroundColor: colors.white, borderRadius: 16, padding: spacing.base, gap: spacing.md,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  heading: { fontSize: typography.md, fontWeight: typography.bold, color: colors.textPrimary },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, alignItems: 'center', backgroundColor: colors.background, borderRadius: 12, padding: spacing.sm },
  statGreen: { backgroundColor: colors.success + '12' },
  statRed: { backgroundColor: colors.error + '10' },
  statNum: { fontSize: typography.xl, fontWeight: typography.bold, color: colors.textPrimary },
  statLabel: { fontSize: typography.xs, color: colors.textSecondary, marginTop: 2 },
  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.success + '12', borderRadius: 10, padding: spacing.sm,
  },
  successText: { fontSize: typography.sm, fontWeight: typography.semiBold, color: colors.success },
  errorToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  errorToggleText: { fontSize: typography.sm, fontWeight: typography.semiBold, color: colors.error },
  errorRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.borderLight,
  },
  errorBadge: { backgroundColor: colors.error + '15', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  errorBadgeText: { fontSize: typography.xs, color: colors.error, fontWeight: typography.semiBold },
  errorName: { fontSize: typography.sm, fontWeight: typography.semiBold, color: colors.textPrimary },
  errorReason: { fontSize: typography.xs, color: colors.textSecondary },
});
