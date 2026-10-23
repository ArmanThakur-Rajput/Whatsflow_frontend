import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';

type Props = { onContinue: () => void };

const FEATURES = [
  {
    icon: 'chatbubbles-outline' as const,
    color: '#0284C7',
    bg: '#E0F2FE',
    title: 'Meet RIVA — Your Personal Real Estate Agent',
    description: 'Add new properties, update existing listings and find properties through a simple conversation.',
  },
  {
    icon: 'business-outline' as const,
    color: '#059669',
    bg: '#D1FAE5',
    title: 'New Property Inventory',
    description: 'Explore property listings with proper details — location, price, area, amenities and photos.',
  },
  {
    icon: 'images-outline' as const,
    color: '#B45309',
    bg: '#FEF3C7',
    title: 'Download Property Images',
    description: 'Open a property photo, browse through the gallery and download one image or all images.',
  },
  {
    icon: 'analytics-outline' as const,
    color: '#6D28D9',
    bg: '#EDE9FE',
    title: 'New Dashboard Insights',
    description: 'Get a clearer overview of leads, properties, pending leads and upcoming visitors.',
  },
  {
    icon: 'notifications-outline' as const,
    color: '#E11D48',
    bg: '#FFE4E6',
    title: 'Property Requirement Notifier',
    description: 'View pending property requirements in one place and keep track as your team processes requests.',
  },
];

export default function WelcomeOnboardingScreen({ onContinue }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F8FC" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 16) + 10, paddingBottom: 18 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandMark}>
          <Ionicons name="sparkles" size={36} color="#0284C7" />
        </View>
        <Text style={styles.eyebrow}>KIN PROPERTY MANAGEMENT</Text>
        <Text style={styles.title}>Meet RIVA</Text>
        <Text style={styles.subtitle}>Your Personal Real Estate Agent</Text>
        <Text style={styles.intro}>Your smarter way to manage properties, discover opportunities and keep your team in sync.</Text>

        <View style={styles.featureList}>
          {FEATURES.map((feature) => (
            <View key={feature.title} style={styles.featureCard}>
              <View style={[styles.featureIcon, { backgroundColor: feature.bg }]}>
                <Ionicons name={feature.icon} size={23} color={feature.color} />
              </View>
              <View style={styles.featureCopy}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.tagline}>Your Property, Our Trust</Text>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <TouchableOpacity style={styles.continueButton} onPress={onContinue} activeOpacity={0.88}>
          <Text style={styles.continueText}>Let's Get Started</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.footerNote}>A better property workflow starts here.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 9999, backgroundColor: '#F4F8FC' },
  content: { paddingHorizontal: 22, alignItems: 'stretch' },
  brandMark: { alignSelf: 'center', width: 72, height: 72, borderRadius: 24, backgroundColor: '#DFF3FF', alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  eyebrow: { textAlign: 'center', color: '#0284C7', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  title: { textAlign: 'center', color: '#172033', fontSize: 32, fontWeight: '900', letterSpacing: -0.8 },
  subtitle: { textAlign: 'center', color: '#0284C7', fontSize: 16, fontWeight: '700', marginTop: 4 },
  intro: { textAlign: 'center', color: '#64748B', fontSize: 13, lineHeight: 19, marginTop: 10, marginBottom: 22, paddingHorizontal: 8 },
  featureList: { gap: 11 },
  featureCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 13, backgroundColor: '#FFFFFF', borderRadius: 17, borderWidth: 1, borderColor: '#E7EDF4', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.035, shadowRadius: 7, elevation: 1 },
  featureIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  featureCopy: { flex: 1, paddingTop: 1 },
  featureTitle: { color: '#172033', fontSize: 13, lineHeight: 18, fontWeight: '800', marginBottom: 4 },
  featureDescription: { color: '#64748B', fontSize: 11.5, lineHeight: 17 },
  tagline: { textAlign: 'center', color: '#7B8798', fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginTop: 20 },
  footer: { paddingTop: 12, paddingHorizontal: 22, backgroundColor: '#F4F8FC', borderTopWidth: 1, borderTopColor: '#E6EDF4' },
  continueButton: { minHeight: 52, borderRadius: 15, backgroundColor: '#079FE3', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: '#0284C7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 3 },
  continueText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  footerNote: { textAlign: 'center', color: '#94A3B8', fontSize: 10, marginTop: 8 },
});
