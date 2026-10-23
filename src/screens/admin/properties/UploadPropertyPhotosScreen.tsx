import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import * as ImagePicker from 'expo-image-picker';
import axiosInstance from '../../../api/axiosInstance';
import { usePropertyStore } from '../../../store/propertyStore';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';

interface PickedPhoto {
  uri: string;
  fileName: string;
  mimeType: string;
}

export default function UploadPropertyPhotosScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { propertyId, isEdit } = route.params as { propertyId: string; isEdit?: boolean };

  const { deletePhoto, getPropertyById } = usePropertyStore();

  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<PickedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPropertyById(propertyId)
      .then((p) => { setExistingPhotos(p.photos || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Camera roll permission needed' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.75,
      // No base64 — we send the file directly via multipart
    });
    if (!result.canceled && result.assets) {
      const picked: PickedPhoto[] = result.assets.map((a, i) => ({
        uri: a.uri,
        fileName: a.fileName || `photo_${Date.now()}_${i}.jpg`,
        mimeType: a.mimeType || 'image/jpeg',
      }));
      setNewPhotos((prev) => [...prev, ...picked]);
    }
  };

  const removeNew = (idx: number) => setNewPhotos((prev) => prev.filter((_, i) => i !== idx));

  const removeExisting = (url: string) => {
    Alert.alert('Delete Photo', 'Remove this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const updated = await deletePhoto(propertyId, url);
            setExistingPhotos(updated);
          } catch {
            Toast.show({ type: 'error', text1: 'Delete failed' });
          }
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (newPhotos.length === 0) {
      Toast.show({ type: 'success', text1: 'Property saved!' });
      navigation.navigate('PropertyDetail', { propertyId });
      return;
    }

    setUploading(true);
    try {
      // Build multipart/form-data — each photo is appended as a file
      const formData = new FormData();
      newPhotos.forEach((p) => {
        formData.append('photos', {
          uri: p.uri,
          name: p.fileName,
          type: p.mimeType,
        } as any);
      });

      await axiosInstance.post(`/property-crm/properties/${propertyId}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Toast.show({ type: 'success', text1: `${newPhotos.length} photo${newPhotos.length > 1 ? 's' : ''} uploaded! 🎉` });
      navigation.navigate('PropertyDetail', { propertyId });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  const totalPhotos = existingPhotos.length + newPhotos.length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        {isEdit ? (
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        ) : <View style={{ width: 36 }} />}
        <Text style={styles.headerTitle}>Upload Photos</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Info */}
          <View style={styles.infoBox}>
            <Ionicons name="images-outline" size={32} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Add Property Photos</Text>
              <Text style={styles.infoSub}>Upload photos to showcase this property. You can skip and add later.</Text>
            </View>
          </View>

          {totalPhotos > 0 && (
            <View style={styles.counterRow}>
              <Text style={styles.counterText}>{totalPhotos} photo{totalPhotos !== 1 ? 's' : ''}</Text>
            </View>
          )}

          {/* Grid */}
          {totalPhotos > 0 && (
            <View style={styles.grid}>
              {existingPhotos.map((url) => (
                <View key={url} style={styles.photoWrap}>
                  <Image source={{ uri: url }} style={styles.photo} />
                  <TouchableOpacity style={styles.removeBtn} onPress={() => removeExisting(url)}>
                    <Ionicons name="close-circle" size={22} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
              {newPhotos.map((p, i) => (
                <View key={i} style={styles.photoWrap}>
                  <Image source={{ uri: p.uri }} style={styles.photo} />
                  <View style={styles.newBadge}><Text style={styles.newBadgeText}>New</Text></View>
                  <TouchableOpacity style={styles.removeBtn} onPress={() => removeNew(i)}>
                    <Ionicons name="close-circle" size={22} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Pick */}
          <TouchableOpacity style={styles.pickBtn} onPress={pickImages}>
            <Ionicons name="camera-outline" size={22} color={colors.primary} />
            <Text style={styles.pickBtnText}>Select Photos from Gallery</Text>
          </TouchableOpacity>

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, uploading && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={uploading}
          >
            {uploading
              ? <ActivityIndicator color={colors.white} />
              : <>
                  <Ionicons name="checkmark-circle-outline" size={20} color={colors.white} />
                  <Text style={styles.saveBtnText}>
                    {newPhotos.length > 0 ? 'Upload & Finish' : 'Skip & Finish'}
                  </Text>
                </>
            }
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.base, paddingVertical: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.textPrimary },
  content: { padding: spacing.base, gap: spacing.md },
  infoBox: { backgroundColor: colors.primaryLight, borderRadius: 16, padding: spacing.base, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  infoTitle: { fontSize: typography.md, fontWeight: typography.bold, color: colors.primary },
  infoSub: { fontSize: typography.xs, color: colors.primary, opacity: 0.8, marginTop: 2 },
  counterRow: { alignItems: 'flex-end' },
  counterText: { fontSize: typography.sm, color: colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoWrap: { width: '31%', aspectRatio: 1, position: 'relative' },
  photo: { width: '100%', height: '100%', borderRadius: 12 },
  removeBtn: { position: 'absolute', top: -6, right: -6 },
  newBadge: { position: 'absolute', bottom: 4, left: 4, backgroundColor: colors.success, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  newBadgeText: { fontSize: 10, color: colors.white, fontWeight: 'bold' },
  pickBtn: {
    borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed', borderRadius: 14,
    padding: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.primaryLight,
  },
  pickBtnText: { fontSize: typography.base, fontWeight: typography.semiBold, color: colors.primary },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: spacing.md + 2,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: typography.md, fontWeight: typography.bold, color: colors.white },
});
