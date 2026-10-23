import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Dimensions, FlatList, Alert, Modal, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { usePropertyStore, Property } from '../../../store/propertyStore';
import axiosInstance from '../../../api/axiosInstance';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';

const { width: windowWidth } = Dimensions.get('window');

// ─── Price display helper ─────────────────────────────────────────────────────
function formatPrice(raw: string | undefined): string {
  if (!raw) return '';
  if (raw.includes('(')) return raw;
  const num = parseFloat(raw.replace(/,/g, ''));
  if (isNaN(num) || num === 0) return raw;
  let short = '';
  if (num >= 10_000_000) short = `${(num / 10_000_000).toFixed(2).replace(/\.?0+$/, '')} Cr`;
  else if (num >= 100_000) short = `${(num / 100_000).toFixed(2).replace(/\.?0+$/, '')} L`;
  else if (num >= 1_000) short = `${(num / 1_000).toFixed(1).replace(/\.?0+$/, '')}k`;
  return short ? `${raw} (${short})` : raw;
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon as any} size={16} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function PropertyDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { propertyId } = route.params as { propertyId: string };
  const { getPropertyById } = usePropertyStore();

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoWidth, setPhotoWidth] = useState(Math.max(260, Math.min(windowWidth - spacing.base * 2, 520)));
  const [failedPhotos, setFailedPhotos] = useState<Record<string, boolean>>({});
  const [activePhoto, setActivePhoto] = useState(0);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const photoUrls = (Array.isArray(property?.photos) ? property!.photos : [])
    .map((photo: any) => typeof photo === 'string' ? photo : (photo?.url || photo?.uri || photo?.location || ''))
    .map((rawUrl: string) => {
      const url = String(rawUrl || '').trim();
      if (!url || /^(https?:)?\/\//i.test(url) || /^(data:image\/|blob:)/i.test(url)) return url;
      if (url.startsWith('/')) {
        const apiBase = String(axiosInstance.defaults.baseURL || '').replace(/\/api\/?$/, '');
        return apiBase ? `${apiBase}${url}` : url;
      }
      return url;
    })
    .filter((url: string) => Boolean(url));

  const makeFileName = (url: string, index: number) => {
    const clean = url.split('?')[0].split('#')[0];
    const ext = clean.match(/\.(jpg|jpeg|png|webp|gif|heic)$/i)?.[1] || 'jpg';
    const base = (property?.projectName || 'property').replace(/[^a-z0-9-_]+/gi, '_');
    return `${base}_photo_${index + 1}.${ext}`;
  };

  const downloadPhoto = async (url: string, index: number) => {
    if (Platform.OS === 'web') {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Photo download failed');
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = makeFileName(url, index);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      } catch {
        // If remote storage blocks browser fetch with CORS, open the original photo so it can still be saved.
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } else {
      await Linking.openURL(url);
    }
  };

  const downloadAllPhotos = async () => {
    if (!photoUrls.length) return;
    setDownloading(true);
    try {
      for (let index = 0; index < photoUrls.length; index += 1) {
        await downloadPhoto(photoUrls[index], index);
        // Space browser download prompts so browsers don't suppress every file after the first.
        if (Platform.OS === 'web' && index < photoUrls.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
      }
    } catch {
      Alert.alert('Download failed', 'Could not download all property photos. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const shareOnWhatsApp = async () => {
    const details = [
      '*KIN PROPERTY MANAGEMENT*',
      '_Your Property, Our Trust_',
      '',
      `*${property?.projectName || 'Property'}*`,
      `${property?.propertyType || ''}${property?.intent ? ` · ${property.intent === 'buy' ? 'For Sale' : 'For Rent'}` : ''}`,
      property?.price ? `Price: ₹${property.price}` : '',
      property?.location ? `Location: ${property.location}` : '',
      property?.floor ? `Floor: ${property.floor}` : '',
      property?.carpetArea ? `Carpet Area: ${property.carpetArea}` : '',
      property?.sanction ? `Sanction: ${property.sanction}` : '',
      property?.parking ? `Parking: ${property.parking}` : '',
      property?.water ? `Water: ${property.water}` : '',
      property?.notes ? `Details: ${property.notes}` : '',
      '',
      photoUrls[0] ? `Photos: ${photoUrls[0]}` : '',
    ].filter(Boolean).join('\n');
    const url = `https://wa.me/?text=${encodeURIComponent(details)}`;
    try { await Linking.openURL(url); } catch { Alert.alert('Unable to open WhatsApp', 'Please check WhatsApp or your browser.'); }
  };

  useEffect(() => {
    let mounted = true;
    // Always fetch fresh data so photos uploaded moments ago aren't hidden by stale Zustand cache.
    getPropertyById(propertyId)
      .then((freshProperty) => { if (mounted) setProperty(freshProperty); })
      .catch(() => { if (mounted) navigation.goBack(); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [propertyId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!property) return null;

  const statusColor = property.status === 'available' ? colors.success : property.status === 'sold' ? colors.error : colors.warning;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{property.projectName}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Photos: measure the actual content width (the browser window may be much wider than the app panel). */}
        {photoUrls.length > 0 && (
          <View style={styles.photoGallery} onLayout={(event) => {
            const measured = event.nativeEvent.layout.width;
            if (measured > 0 && measured !== photoWidth) setPhotoWidth(measured);
          }}>
            <FlatList
              data={photoUrls}
              horizontal
              pagingEnabled
              keyExtractor={(url, index) => `${url}-${index}`}
              showsHorizontalScrollIndicator={false}
              style={styles.photoStrip}
              onMomentumScrollEnd={(event) => setActivePhoto(Math.round(event.nativeEvent.contentOffset.x / photoWidth))}
              getItemLayout={(_, index) => ({ length: photoWidth, offset: photoWidth * index, index })}
              renderItem={({ item, index }) => (
                <View style={{ width: photoWidth, height: 250, borderRadius: 16, overflow: 'hidden', backgroundColor: '#E9EEF3' }}>
                  {failedPhotos[item] ? (
                    <View style={styles.photoFallback}>
                      <Ionicons name="image-outline" size={38} color={colors.textSecondary} />
                      <Text style={styles.photoFallbackText}>Photo could not be loaded</Text>
                    </View>
                  ) : (
                    <TouchableOpacity activeOpacity={0.92} onPress={() => setSelectedPhoto(item)} style={{ flex: 1 }}>
                      <Image
                        source={{ uri: item }}
                        style={styles.heroPhoto}
                        resizeMode="cover"
                        onError={() => setFailedPhotos((previous) => ({ ...previous, [item]: true }))}
                      />
                    </TouchableOpacity>
                  )}
                  <View style={styles.photoCounter}><Text style={styles.photoCounterText}>{index + 1} / {photoUrls.length}</Text></View>
                </View>
              )}
            />
            {photoUrls.length > 1 && (
              <View style={styles.photoDots}>
                {photoUrls.map((url, index) => <View key={`${url}-dot-${index}`} style={[styles.photoDot, index === activePhoto && styles.photoDotActive]} />)}
              </View>
            )}
          </View>
        )}

        {/* Status + Title */}
        <View style={styles.card}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {property.status === 'available' ? 'Available' : property.status === 'sold' ? 'Sold' : 'Rented'}
            </Text>
          </View>
          <Text style={styles.name}>{property.projectName}</Text>
          <Text style={styles.sub}>{property.propertyType} · {property.intent === 'buy' ? 'For Sale' : 'For Rent'}</Text>
          {property.price ? <Text style={styles.price}>₹ {formatPrice(property.price)}</Text> : null}
        </View>

        {/* Property Details — show every saved field from Add/Edit Property */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Property Details</Text>
          <InfoRow icon="location-outline" label="Location" value={property.location || '—'} />
          {property.address && <InfoRow icon="map-outline" label="Address" value={property.address} />}
          {property.floor && <InfoRow icon="layers-outline" label="Floor" value={property.floor === 'Ground' ? 'Ground Floor' : `${property.floor}${/^\d+$/.test(property.floor) ? (Number(property.floor) % 100 >= 11 && Number(property.floor) % 100 <= 13 ? 'th' : ({1:'st',2:'nd',3:'rd'} as Record<number,string>)[Number(property.floor) % 10] || 'th') : ''} Floor`} />}
          {property.flatConfig && <InfoRow icon="home-outline" label="Configuration" value={property.flatConfig} />}
          {property.carpetArea && <InfoRow icon="expand-outline" label="Carpet Area" value={`${property.carpetArea}${/sq\.?\s*ft|sqft/i.test(property.carpetArea) ? '' : ' sqft'}`} />}
          {property.buildupArea && <InfoRow icon="grid-outline" label="Buildup Area" value={`${property.buildupArea}${/sq\.?\s*ft|sqft/i.test(property.buildupArea) ? '' : ' sqft'}`} />}
          {property.plotArea && <InfoRow icon="map-outline" label="Plot Area" value={property.plotArea} />}
          {property.buildingArea && <InfoRow icon="business-outline" label="Building Area" value={property.buildingArea} />}
          {property.flatsOnFloor && <InfoRow icon="business-outline" label="Flats on Same Floor" value={property.flatsOnFloor} />}
          {property.wings && <InfoRow icon="git-branch-outline" label="Wings" value={property.wings} />}
          {property.facing && <InfoRow icon="compass-outline" label="Facing" value={property.facing} />}
          {property.sanction && <InfoRow icon="document-attach-outline" label="Sanction" value={property.sanction} />}
          {property.parking && <InfoRow icon="car-outline" label="Parking" value={property.parking} />}
          {property.water && <InfoRow icon="water-outline" label="Water Source" value={property.water} />}
          {property.lift && <InfoRow icon="business-outline" label="Lift" value={property.lift} />}
          {property.amenities?.length ? (
            <InfoRow icon="checkmark-circle-outline" label="Amenities" value={property.amenities.join(', ')} />
          ) : null}
          {property.gmapsLink && <InfoRow icon="navigate-outline" label="Google Maps Link" value={property.gmapsLink} />}
          {property.notes && <InfoRow icon="document-text-outline" label="Notes" value={property.notes} />}
        </View>

        {/* Contact Details */}
        {(property.ownerName || property.ownerPhone || property.tenantPhone) && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Contact Details</Text>
            {property.ownerName && <InfoRow icon="person-outline" label="Owner Name" value={property.ownerName} />}
            {property.ownerPhone && <InfoRow icon="call-outline" label="Owner Phone" value={property.ownerPhone} />}
            {property.tenantPhone && <InfoRow icon="call-outline" label="Tenant Phone" value={property.tenantPhone} />}
          </View>
        )}

        {/* Only the requested actions: WhatsApp and Photos */}
        <View style={styles.actionsCard}>
          <TouchableOpacity style={styles.actionBtn} onPress={shareOnWhatsApp}>
            <Ionicons name="logo-whatsapp" size={20} color="#16A34A" />
            <Text style={[styles.actionText, { color: '#16A34A' }]}>WhatsApp Send</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('UploadPropertyPhotos', { propertyId: property._id, isEdit: true })}
          >
            <Ionicons name="images-outline" size={20} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>Photos</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={Boolean(selectedPhoto)} transparent animationType="fade" onRequestClose={() => setSelectedPhoto(null)}>
        <View style={styles.photoModalBackdrop}>
          <View style={styles.photoModalCard}>
            <View style={styles.photoModalHeader}>
              <Text style={styles.photoModalTitle} numberOfLines={1}>{property.projectName}</Text>
              <TouchableOpacity onPress={() => setSelectedPhoto(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            {selectedPhoto ? <Image source={{ uri: selectedPhoto }} style={styles.modalImage} resizeMode="contain" /> : null}
            <View style={styles.downloadActions}>
              <TouchableOpacity style={styles.downloadBtn} onPress={() => {
                const index = Math.max(0, photoUrls.indexOf(selectedPhoto || ''));
                if (selectedPhoto) downloadPhoto(selectedPhoto, index);
              }}>
                <Ionicons name="download-outline" size={19} color={colors.white} />
                <Text style={styles.downloadBtnText}>Download This</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.downloadBtn, styles.downloadAllBtn]} onPress={downloadAllPhotos} disabled={downloading}>
                {downloading ? <ActivityIndicator color={colors.white} /> : <Ionicons name="cloud-download-outline" size={19} color={colors.white} />}
                <Text style={styles.downloadBtnText}>{downloading ? 'Downloading…' : `Download All Images (${photoUrls.length})`}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.downloadHint}>Download All saves each photo as a separate image file.</Text>
          </View>
        </View>
      </Modal>
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
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { flex: 1, fontSize: typography.lg, fontWeight: typography.bold, color: colors.textPrimary, textAlign: 'center' },
  content: { padding: spacing.base, gap: spacing.md },
  photoModalBackdrop: { flex: 1, backgroundColor: 'rgba(8,15,25,0.86)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  photoModalCard: { width: '100%', maxWidth: 900, maxHeight: '92%', backgroundColor: colors.white, borderRadius: 18, padding: 14, gap: 12 },
  photoModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  photoModalTitle: { flex: 1, fontSize: typography.md, fontWeight: typography.bold, color: colors.textPrimary },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  modalImage: { width: '100%', height: 430, backgroundColor: '#111827', borderRadius: 12 },
  downloadActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  downloadBtn: { flex: 1, minWidth: 150, backgroundColor: colors.primary, borderRadius: 11, paddingVertical: 13, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  downloadAllBtn: { backgroundColor: '#16A34A' },
  downloadBtnText: { color: colors.white, fontSize: typography.sm, fontWeight: typography.bold },
  downloadHint: { color: colors.textSecondary, fontSize: typography.xs, textAlign: 'center' },
  photoGallery: { width: '100%', borderRadius: 16, marginBottom: 4, overflow: 'hidden' },
  photoStrip: { width: '100%', borderRadius: 16 },
  heroPhoto: { width: '100%', height: '100%' },
  photoFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  photoFallbackText: { color: colors.textSecondary, fontSize: typography.sm },
  photoCounter: { position: 'absolute', right: 12, bottom: 12, backgroundColor: 'rgba(0,0,0,0.62)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  photoCounterText: { color: '#fff', fontSize: typography.xs, fontWeight: '700' },
  photoDots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingTop: 10 },
  photoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#C7D0DA' },
  photoDotActive: { width: 18, backgroundColor: colors.primary },
  card: {
    backgroundColor: colors.white, borderRadius: 16, padding: spacing.base, gap: spacing.sm,
    elevation: 1, shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: typography.xs, fontWeight: typography.bold },
  name: { fontSize: typography.xl, fontWeight: typography.bold, color: colors.textPrimary },
  sub: { fontSize: typography.sm, color: colors.textSecondary },
  price: { fontSize: typography.xxl, fontWeight: typography.bold, color: colors.primary },
  sectionTitle: { fontSize: typography.md, fontWeight: typography.bold, color: colors.textPrimary, marginBottom: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  infoIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center',
    marginTop: 2,
  },
  infoLabel: { fontSize: typography.xs, color: colors.textSecondary, marginBottom: 1 },
  infoValue: { fontSize: typography.base, color: colors.textPrimary },
  actionsCard: {
    backgroundColor: colors.white, borderRadius: 16, padding: spacing.md,
    flexDirection: 'row', gap: spacing.sm,
    elevation: 1, shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, paddingVertical: spacing.md,
    backgroundColor: colors.background, borderRadius: 12,
  },
  actionText: { fontSize: typography.sm, fontWeight: typography.bold },
});
