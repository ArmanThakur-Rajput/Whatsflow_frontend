import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Dimensions, FlatList, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { usePropertyStore, Property } from '../../../store/propertyStore';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';

const { width } = Dimensions.get('window');

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
  const { getPropertyById, deleteProperty } = usePropertyStore();

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  const handleDelete = () => {
    Alert.alert(
      'Delete Property',
      'This will permanently delete this property and all its photos. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              await deleteProperty(propertyId);
              navigation.goBack();
            } catch {
              Alert.alert('Error', 'Failed to delete property');
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    getPropertyById(propertyId)
      .then(setProperty)
      .catch(() => navigation.goBack())
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!property) return null;

  const statusColor = property.status === 'available' ? colors.success : property.status === 'sold' ? colors.error : colors.warning;
  const knownKeys = new Set(['_id','id','__v','projectName','society','society/project','propertyType','intent','price','location','address','floor','flatConfig','carpetArea','buildupArea','plotArea','buildingArea','flatsOnFloor','wings','facing','sanction','parking','water','lift','amenities','gmapsLink','notes','ownerName','ownerPhone','tenantPhone','photos','status','createdAt','updatedAt','tenantId','orgId','sessionId']);
  const dynamicEntries = Object.entries(property as any).filter(([key, value]) => !knownKeys.has(key) && value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0));
  const prettyLabel = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').replace(/^./, c => c.toUpperCase());
  const displayValue = (value: any) => Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{property.projectName || (property as any).society || (property as any)['society/project'] || 'Property'}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('AddProperty', { editId: property._id })}>
            <Ionicons name="pencil-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Photos */}
        {(property.photos?.length ?? 0) > 0 && (
          <FlatList
            data={property.photos || []}
            horizontal
            pagingEnabled
            keyExtractor={(u) => u}
            showsHorizontalScrollIndicator={false}
            style={styles.photoStrip}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={{ width: width - spacing.base * 2, height: 220, borderRadius: 16 }} />
            )}
          />
        )}

        {/* Status + Title */}
        <View style={styles.card}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {property.status === 'available' ? 'Available' : property.status === 'sold' ? 'Sold' : 'Rented'}
            </Text>
          </View>
          <Text style={styles.name}>{property.projectName || (property as any).society || (property as any)['society/project'] || 'Property'}</Text>
          <Text style={styles.sub}>{property.propertyType || (property as any).flatConfig || 'Property'}{property.intent ? ` · ${property.intent === 'buy' ? 'For Sale' : 'For Rent'}` : ''}</Text>
          {property.price ? <Text style={styles.price}>₹ {formatPrice(property.price)}</Text> : null}
        </View>

        {/* Property Details — show every saved field from Add/Edit Property */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Property Details</Text>
          <InfoRow icon="location-outline" label="Location" value={property.location || '—'} />
          {property.address && <InfoRow icon="map-outline" label="Address" value={property.address} />}
          {property.floor && <InfoRow icon="layers-outline" label="Floor" value={property.floor === 'Ground' ? 'Ground Floor' : `${property.floor}${/^\d+$/.test(property.floor) ? (Number(property.floor) % 100 >= 11 && Number(property.floor) % 100 <= 13 ? 'th' : ({1:'st',2:'nd',3:'rd'} as Record<number,string>)[Number(property.floor) % 10] || 'th') : ''} Floor`} />}
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
          {dynamicEntries.map(([key, value]) => <InfoRow key={key} icon="information-circle-outline" label={prettyLabel(key)} value={displayValue(value)} />)}
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

        {/* Actions */}
        <View style={styles.actionsCard}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('AddProperty', { editId: property._id })}
          >
            <Ionicons name="pencil-outline" size={20} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('UploadPropertyPhotos', { propertyId: property._id, isEdit: true })}
          >
            <Ionicons name="images-outline" size={20} color={colors.success} />
            <Text style={[styles.actionText, { color: colors.success }]}>Photos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
            <Text style={[styles.actionText, { color: colors.error }]}>Delete</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  headerActions: { flexDirection: 'row', gap: spacing.xs },
  editBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  deleteBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.error + '18', justifyContent: 'center', alignItems: 'center',
  },
  content: { padding: spacing.base, gap: spacing.md },
  photoStrip: { borderRadius: 16, marginBottom: 4 },
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
