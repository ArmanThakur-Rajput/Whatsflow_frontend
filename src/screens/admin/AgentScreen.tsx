/**
 * AgentScreen.tsx — Riva AI · Professional Real Estate AI
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  Animated, Easing, StatusBar, Vibration, Clipboard,
  Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import * as Speech from 'expo-speech';
import Svg, { Circle, Ellipse, Path, Polyline, Line, Polygon, Rect } from 'react-native-svg';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

// ─────────────────────────────────────────────────────────────────────────────
const N8N_WEBHOOK_URL =
  'https://whatsapp-lead-n8n.ndna0p.easypanel.host/webhook/test';

// 🔐 Secret key — n8n Header Auth se match karna chahiye
// Production mein isko expo-constants ya env se lo, hardcode mat karo
const WEBHOOK_SECRET_KEY = 'riva-secret-2024';
// ─────────────────────────────────────────────────────────────────────────────

type MicState = 'idle' | 'listening' | 'processing';
type MsgRole  = 'user' | 'agent';

interface Msg {
  id:       string;
  role:     MsgRole;
  text:     string;
  ts:       Date;
  status?:  'sending' | 'sent' | 'error';
  property?: { society: string; location: string; price: string; bhk: string };
}

const SESSION_ID = `session_${Date.now()}`;

// ── Design tokens (matches preview exactly) ──────────────────────────────────
const C = {
  gradA:       '#1243A8',
  gradB:       '#2563EB',
  gradC:       '#3B82F6',
  blue:        '#2563EB',
  blueDark:    '#1D4ED8',
  chatBg:      '#EEF2F8',
  userBubble:  '#2563EB',
  agentBubble: '#FFFFFF',
  green:       '#22C55E',
  red:         '#EF4444',
  amber:       '#F59E0B',
  cardBg:      '#F0F7FF',
  cardBorder:  '#BFDBFE',
  inputBg:     '#F5F7FA',
  border:      '#E5E7EB',
  text:        '#1A1A2E',
  textSec:     '#374151',
  textLight:   '#9CA3AF',
  textNavy:    '#1E3A5F',
  white:       '#FFFFFF',
};

const WELCOME: Msg = {
  id: 'welcome', role: 'agent', ts: new Date(), status: 'sent',
  text: "Hello! I'm Riva AI 👋\nYou can type your property details or use the mic to speak — I'll help you add, search or find the best properties.",
};

// ─── SVG Avatar (professional female silhouette) ─────────────────────────────
function RivaAvatar({ size = 36, small = false }: { size?: number; small?: boolean }) {
  const s = size;
  // Scale the SVG paths for a 62-unit viewBox
  return (
    <Svg width={s} height={s} viewBox="0 0 62 62">
      {/* Hair */}
      <Ellipse cx="31" cy="15" rx="10" ry="7" fill={small ? 'white' : C.gradB} opacity={small ? '0.9' : '1'} />
      {/* Head */}
      <Ellipse cx="31" cy="21" rx="11" ry="12" fill={small ? 'white' : C.blueDark} opacity={small ? '0.9' : '1'} />
      {/* Face */}
      <Ellipse cx="31" cy="23" rx="8.5" ry="9" fill={small ? 'rgba(255,255,255,0.85)' : '#DBEAFE'} />
      {/* Body/shoulders */}
      <Path d="M10 58 C10 41 17 35 31 35 C45 35 52 41 52 58Z" fill={small ? 'white' : C.blueDark} opacity={small ? '0.75' : '1'} />
      {/* Collar highlight */}
      <Path d="M25 35 L31 42 L37 35" fill={small ? 'rgba(255,255,255,0.5)' : '#EFF6FF'} opacity="0.8" />
      {/* Face highlight */}
      <Ellipse cx="27.5" cy="21" rx="2" ry="2.5" fill="white" opacity="0.2" />
    </Svg>
  );
}

// ─── Entry Animation Overlay ──────────────────────────────────────────────────
function EntryOverlay({ onDone }: { onDone: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const scale   = useRef(new Animated.Value(0.55)).current;
  const textY   = useRef(new Animated.Value(12)).current;
  const textOp  = useRef(new Animated.Value(0)).current;
  const ring1   = useRef(new Animated.Value(1)).current;
  const ring2   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, tension: 55, friction: 7, useNativeDriver: true }).start();

    const ringLoop = (r: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(r, { toValue: 1.12, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(r, { toValue: 1,    duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]));
    const a1 = ringLoop(ring1, 0);
    const a2 = ringLoop(ring2, 550);
    a1.start(); a2.start();

    Animated.parallel([
      Animated.timing(textOp, { toValue: 1, duration: 500, delay: 380, useNativeDriver: true }),
      Animated.timing(textY,  { toValue: 0, duration: 500, delay: 380, useNativeDriver: true }),
    ]).start();

    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 450, useNativeDriver: true }).start(onDone);
    }, 2200);

    return () => { clearTimeout(t); a1.stop(); a2.stop(); };
  }, []);

  return (
    <Animated.View style={[eoS.overlay, { opacity }]}>
      <LinearGradient colors={[C.gradA, C.gradB, C.gradC]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={eoS.grad}>
        <View style={eoS.center}>
          {/* Rings */}
          <Animated.View style={[eoS.ring, eoS.r1, { transform: [{ scale: ring1 }] }]} />
          <Animated.View style={[eoS.ring, eoS.r2, { transform: [{ scale: ring2 }] }]} />
          {/* Avatar */}
          <Animated.View style={[eoS.avatarWrap, { transform: [{ scale }] }]}>
            <RivaAvatar size={92} />
          </Animated.View>
          {/* Text */}
          <Animated.View style={[eoS.textBlock, { opacity: textOp, transform: [{ translateY: textY }] }]}>
            <Text style={eoS.name}>Riva AI</Text>
            <Text style={eoS.tagline}>Talk to Riva</Text>
            <Text style={eoS.sub}>Property Assistant</Text>
          </Animated.View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}
const eoS = StyleSheet.create({
  overlay:    { ...StyleSheet.absoluteFillObject, zIndex: 999 },
  grad:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center:     { alignItems: 'center' },
  ring:       { position: 'absolute', borderRadius: 9999, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)' },
  r1:         { width: 150, height: 150, borderRadius: 75 },
  r2:         { width: 182, height: 182, borderRadius: 91 },
  avatarWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)',
    elevation: 18, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
  },
  textBlock:  { marginTop: 24, alignItems: 'center' },
  name:       { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
  tagline:    { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.88)', marginTop: 5 },
  sub:        { fontSize: 12, color: 'rgba(255,255,255,0.62)', marginTop: 3 },
});

// ─── Typing Dots ──────────────────────────────────────────────────────────────
function TypingDots() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const anims = dots.map((d, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 150),
      Animated.timing(d, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(d, { toValue: 0, duration: 350, useNativeDriver: true }),
      Animated.delay(300),
    ])));
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);
  return (
    <View style={tdS.row}>
      <View style={tdS.av}><RivaAvatar size={16} small /></View>
      <View style={tdS.bubble}>
        {dots.map((d, i) => (
          <Animated.View key={i} style={[tdS.dot, { opacity: d, transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }]} />
        ))}
      </View>
    </View>
  );
}
const tdS = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, marginVertical: 3 },
  av:     { width: 26, height: 26, borderRadius: 13, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginRight: 7 },
  bubble: { backgroundColor: C.white, borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 16, paddingVertical: 13, flexDirection: 'row', gap: 5, elevation: 2 },
  dot:    { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.blue },
});

// ─── Property Card ────────────────────────────────────────────────────────────
function PropertyCard({ p, onReply }: { p: NonNullable<Msg['property']>; onReply: (ans: string) => void }) {
  const [answered, setAnswered] = useState(false);
  const rows = [
    { label: 'Society',  val: p.society,  icon: 'business-outline'    },
    { label: 'Location', val: p.location, icon: 'location-outline'    },
    { label: 'Price',    val: p.price,    icon: 'pricetag-outline'    },
    { label: 'BHK',      val: p.bhk,      icon: 'bed-outline'         },
  ];
  const handleAnswer = (ans: string) => {
    if (answered) return;
    setAnswered(true);
    onReply(ans);
  };
  return (
    <View style={pcS.card}>
      <View style={pcS.head}>
        <Ionicons name="home-outline" size={15} color={C.blue} />
        <Text style={pcS.title}>Property Details</Text>
      </View>
      <Text style={pcS.sub}>Please review the details before saving.</Text>
      <View style={pcS.divider} />
      {rows.map((r, i) => (
        <View key={i} style={[pcS.row, i < rows.length - 1 && pcS.rowBorder]}>
          <Ionicons name={r.icon as any} size={14} color="#6B7280" style={{ marginRight: 7 }} />
          <Text style={pcS.label}>{r.label}</Text>
          <Text style={pcS.val}>{r.val}</Text>
        </View>
      ))}
      <View style={pcS.confirm}>
        <Ionicons name="information-circle-outline" size={13} color={C.blue} style={{ marginTop: 1 }} />
        <Text style={pcS.confirmTxt}>Is this correct?</Text>
      </View>
      <View style={pcS.btnRow}>
        <TouchableOpacity
          style={[pcS.btn, pcS.btnYes, answered && pcS.btnDisabled]}
          onPress={() => handleAnswer('Yes')}
          activeOpacity={0.8}
          disabled={answered}
        >
          <Ionicons name="checkmark" size={15} color="#fff" />
          <Text style={pcS.btnTxt}>Yes, Save</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[pcS.btn, pcS.btnNo, answered && pcS.btnDisabled]}
          onPress={() => handleAnswer('No')}
          activeOpacity={0.8}
          disabled={answered}
        >
          <Ionicons name="close" size={15} color="#fff" />
          <Text style={pcS.btnTxt}>No, Modify</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const pcS = StyleSheet.create({
  card:       { backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.cardBorder, borderRadius: 10, marginTop: 7, overflow: 'hidden' },
  head:       { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, paddingBottom: 3 },
  title:      { fontSize: 11.5, fontWeight: '700', color: C.textNavy },
  sub:        { fontSize: 10, color: '#6B7280', paddingHorizontal: 10, paddingBottom: 5 },
  divider:    { height: 1, backgroundColor: C.cardBorder },
  row:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7 },
  rowBorder:  { borderBottomWidth: 1, borderBottomColor: '#EFF6FF' },
  label:      { flex: 1, fontSize: 12, color: C.textSec },
  val:        { fontSize: 12, fontWeight: '700', color: C.textNavy },
  confirm:    { flexDirection: 'row', alignItems: 'flex-start', gap: 5, backgroundColor: '#EFF6FF', marginHorizontal: 7, marginTop: 7, borderRadius: 7, padding: 8 },
  confirmTxt: { flex: 1, fontSize: 10.5, color: C.blue, lineHeight: 15.5, fontWeight: '600' },
  btnRow:     { flexDirection: 'row', gap: 8, padding: 8, paddingTop: 6 },
  btn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, paddingVertical: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  btnYes:     { backgroundColor: '#16A34A' },
  btnNo:      { backgroundColor: '#DC2626' },
  btnDisabled:{ opacity: 0.5 },
  btnTxt:     { fontSize: 13, fontWeight: '700', color: '#fff' },
});

// ─── Message Bubble ───────────────────────────────────────────────────────────
function Bubble({ msg, onSpeak, onRetry, onCopy, isMuted, onReply }: {
  msg: Msg; onSpeak: (t: string) => void;
  onRetry: (m: Msg) => void; onCopy: (t: string) => void; isMuted: boolean;
  onReply: (ans: string) => void;
}) {
  const isUser = msg.role === 'user';
  const fade   = useRef(new Animated.Value(0)).current;
  const slide  = useRef(new Animated.Value(isUser ? 28 : -28)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  const time = msg.ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <Animated.View style={[bS.row, isUser ? bS.rowR : bS.rowL, { opacity: fade, transform: [{ translateX: slide }] }]}>
      {!isUser && (
        <View style={bS.av}><RivaAvatar size={16} small /></View>
      )}
      <View style={{ maxWidth: '75%' }}>
        <View style={[bS.bubble, isUser ? bS.bUser : bS.bAgent]}>
          <Text style={[bS.text, isUser ? bS.tUser : bS.tAgent]}>{msg.text}</Text>
          {msg.property && <PropertyCard p={msg.property} onReply={onReply} />}
          <View style={bS.foot}>
            <Text style={[bS.time, isUser && bS.timeU]}>{time}</Text>
            {isUser && (
              msg.status === 'sending'
                ? <ActivityIndicator size={10} color="rgba(255,255,255,0.6)" style={{ marginLeft: 4 }} />
                : msg.status === 'error'
                ? <TouchableOpacity onPress={() => onRetry(msg)} style={bS.retryBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="refresh" size={11} color="#fff" />
                    <Text style={bS.retryTxt}>Retry</Text>
                  </TouchableOpacity>
                : <Ionicons name="checkmark-done" size={12} color="rgba(255,255,255,0.6)" style={{ marginLeft: 3 }} />
            )}
            {!isUser && !isMuted && (
              <TouchableOpacity onPress={() => onSpeak(msg.text)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 5 }}>
                <Ionicons name="volume-medium-outline" size={13} color="#9CA3AF" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => onCopy(msg.text)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 4 }}>
              <Ionicons name="copy-outline" size={12} color={isUser ? 'rgba(255,255,255,0.5)' : '#9CA3AF'} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}
const bS = StyleSheet.create({
  row:      { flexDirection: 'row', marginVertical: 2, paddingHorizontal: 10, alignItems: 'flex-end' },
  rowR:     { justifyContent: 'flex-end' },
  rowL:     { justifyContent: 'flex-start' },
  av:       { width: 26, height: 26, borderRadius: 13, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginRight: 7, marginBottom: 2 },
  bubble:   { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 },
  bUser:    { backgroundColor: C.userBubble, borderBottomRightRadius: 4 },
  bAgent:   { backgroundColor: C.agentBubble, borderBottomLeftRadius: 4 },
  text:     { fontSize: 14, lineHeight: 21 },
  tUser:    { color: '#fff' },
  tAgent:   { color: C.text },
  foot:     { flexDirection: 'row', alignItems: 'center', marginTop: 4, justifyContent: 'flex-end' },
  time:     { fontSize: 9.5, color: '#9CA3AF' },
  timeU:    { color: 'rgba(255,255,255,0.58)' },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 4 },
  retryTxt: { fontSize: 10, color: '#fff', fontWeight: '600' },
});

// ─── Quick Chips ──────────────────────────────────────────────────────────────
const CHIPS = [
  { icon: 'people-outline',        label: 'Qualify a Lead'    },
  { icon: 'call-outline',          label: 'Follow-up Script'  },
  { icon: 'home-outline',          label: 'Find Property'     },
  { icon: 'document-text-outline', label: 'Handle Objections' },
];

// ─── Pulse Orb (hero mode) ────────────────────────────────────────────────────
function PulseOrb({ mic, speaking }: { mic: MicState; speaking: boolean }) {
  const rings = [useRef(new Animated.Value(1)).current, useRef(new Animated.Value(1)).current, useRef(new Animated.Value(1)).current];
  const active = mic === 'listening' || speaking;
  const col    = speaking ? C.green : mic === 'listening' ? C.red : C.blue;

  useEffect(() => {
    if (!active) { rings.forEach(r => r.setValue(1)); return; }
    const anims = rings.map((r, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 260),
      Animated.timing(r, { toValue: speaking ? 2.3 : 1.95, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(r, { toValue: 1, duration: 700, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ])));
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, [active, speaking]);

  return (
    <View style={oS.wrap}>
      {rings.map((r, i) => (
        <Animated.View key={i} style={[oS.ring, { width: 72 + i * 28, height: 72 + i * 28, borderRadius: (72 + i * 28) / 2, backgroundColor: col + ['26', '14', '08'][i], transform: [{ scale: r }] }]} />
      ))}
      <View style={[oS.core, { backgroundColor: col, shadowColor: col }]}>
        <Ionicons name={speaking ? 'volume-high' : mic === 'listening' ? 'mic' : 'sparkles'} size={27} color="#fff" />
      </View>
    </View>
  );
}
const oS = StyleSheet.create({
  wrap: { width: 148, height: 148, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute' },
  core: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', elevation: 14, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 14 },
});

// ─── More Menu ────────────────────────────────────────────────────────────────
function MoreMenu({ visible, onClose, onCopyAll, onNewChat }: { visible: boolean; onClose: () => void; onCopyAll: () => void; onNewChat: () => void }) {
  const items = [
    { icon: 'copy-outline',         label: 'Copy entire chat', action: onCopyAll },
    { icon: 'share-social-outline', label: 'Share chat',       action: onCopyAll },
    { icon: 'add-circle-outline',   label: 'New conversation', action: onNewChat },
  ];
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={mmS.backdrop} onPress={onClose}>
        <View style={mmS.menu}>
          {items.map((it, i) => (
            <TouchableOpacity key={i} style={[mmS.item, i < items.length - 1 && mmS.border]} onPress={() => { it.action(); onClose(); }}>
              <Ionicons name={it.icon as any} size={17} color={C.blue} />
              <Text style={mmS.txt}>{it.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}
const mmS = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.28)' },
  menu:     { position: 'absolute', top: 62, right: 12, backgroundColor: C.white, borderRadius: 14, elevation: 14, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, minWidth: 196 },
  item:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 14 },
  border:   { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  txt:      { fontSize: 14, color: C.text, fontWeight: '500' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AgentScreen() {
  const navigation = useNavigation<any>();
  const insets     = useSafeAreaInsets();
  const listRef    = useRef<FlatList>(null);

  const [showEntry, setShowEntry] = useState(true);
  const [msgs,      setMsgs]      = useState<Msg[]>([WELCOME]);
  const [inputText, setInputText] = useState('');
  const [thinking,  setThinking]  = useState(false);
  const [orbMode,   setOrbMode]   = useState(true);
  const [micState,  setMicState]  = useState<MicState>('idle');
  const [speaking,  setSpeaking]  = useState(false);
  const [liveText,  setLiveText]  = useState('');
  const [isMuted,   setIsMuted]   = useState(false);
  const [showMore,  setShowMore]  = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  // ── Speech events ─────────────────────────────────────────────────────────
  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results?.[0]?.transcript ?? '';
    if (event.isFinal) {
      if (text.trim()) { setInputText(text); setLiveText(''); setMicState('processing'); sendToWebhook(text); }
      else { setMicState('idle'); setLiveText(''); }
    } else { setLiveText(text); setInputText(text); }
  });
  useSpeechRecognitionEvent('error', (event) => {
    setMicState('idle'); setLiveText('');
    if (event.error !== 'aborted' && event.error !== 'no-speech')
      Toast.show({ type: 'error', text1: 'Voice error', text2: event.message ?? 'Please try again.', position: 'top' });
  });
  useSpeechRecognitionEvent('end', () => { setMicState(p => p === 'listening' ? 'idle' : p); });

  // ── TTS ───────────────────────────────────────────────────────────────────
  const speakText = useCallback(async (text: string) => {
    if (isMuted) return;
    const isSp = await Speech.isSpeakingAsync();
    if (isSp) { Speech.stop(); setSpeaking(false); return; }
    setSpeaking(true);
    Speech.speak(text, { language: 'hi-IN', pitch: 1.0, rate: 0.9, onDone: () => setSpeaking(false), onError: () => setSpeaking(false), onStopped: () => setSpeaking(false) });
  }, [isMuted]);

  // ── Stop ──────────────────────────────────────────────────────────────────
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    Speech.stop(); setSpeaking(false); setThinking(false); setMicState('idle');
    ExpoSpeechRecognitionModule.abort(); setLiveText('');
    Toast.show({ type: 'info', text1: 'Stopped', text2: 'Request cancelled.', position: 'top' });
  }, []);

  // ── Webhook ───────────────────────────────────────────────────────────────
  const sendToWebhook = useCallback(async (text: string) => {
    if (!text.trim()) { setMicState('idle'); return; }
    if (orbMode) setOrbMode(false);
    Vibration.vibrate(22);
    const userMsg: Msg = { id: `u${Date.now()}`, role: 'user', text: text.trim(), ts: new Date(), status: 'sending' };
    setMsgs(prev => [...prev, userMsg]);
    setInputText(''); setThinking(true);
    abortRef.current = new AbortController();
    try {
      const res = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': WEBHOOK_SECRET_KEY,   // 🔐 Secret header
        },
        signal: abortRef.current.signal,
        body: JSON.stringify({ type: 'text', sessionId: SESSION_ID, message: text.trim(), timestamp: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data  = await res.json();
      const reply = data?.reply || data?.output || data?.message || data?.text || 'No response received.';
      setMsgs(prev => prev.map(m => m.id === userMsg.id ? { ...m, status: 'sent' } : m));
      const agentMsg: Msg = { id: `a${Date.now()}`, role: 'agent', text: reply, ts: new Date(), status: 'sent', property: data?.property ?? undefined };
      setMsgs(prev => [...prev, agentMsg]);
      speakText(reply);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setMsgs(prev => prev.map(m => m.id === userMsg.id ? { ...m, status: 'error' } : m));
      Toast.show({ type: 'error', text1: 'Agent unavailable', text2: err.message, position: 'top' });
    } finally { setThinking(false); setMicState('idle'); }
  }, [orbMode, speakText]);

  const handleRetry = useCallback((msg: Msg) => { setMsgs(p => p.filter(m => m.id !== msg.id)); sendToWebhook(msg.text); }, [sendToWebhook]);
  const handleCopy  = useCallback((text: string) => { Clipboard.setString(text); Toast.show({ type: 'success', text1: 'Copied!', position: 'top' }); }, []);
  const handleCopyAll = useCallback(() => {
    Clipboard.setString(msgs.map(m => `[${m.role === 'user' ? 'You' : 'Riva Bot'}] ${m.text}`).join('\n\n'));
    Toast.show({ type: 'success', text1: 'Chat copied!', position: 'top' });
  }, [msgs]);
  const handleNewChat = useCallback(() => {
    abortRef.current?.abort(); Speech.stop(); setSpeaking(false); ExpoSpeechRecognitionModule.abort();
    setMsgs([WELCOME]); setOrbMode(true); setThinking(false); setMicState('idle'); setInputText(''); setLiveText('');
  }, []);

  const handleMic = useCallback(async () => {
    if (micState === 'listening') { ExpoSpeechRecognitionModule.stop(); return; }
    if (micState === 'processing' || thinking) return;
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) { Toast.show({ type: 'error', text1: 'Mic permission denied', position: 'top' }); return; }
    try {
      Speech.stop(); setSpeaking(false); setLiveText(''); setInputText(''); setMicState('listening');
      if (orbMode) setOrbMode(false);
      Vibration.vibrate(40);
      ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: false });
    } catch (err: any) { setMicState('idle'); Toast.show({ type: 'error', text1: 'Mic start failed', text2: err.message, position: 'top' }); }
  }, [micState, thinking, orbMode]);

  const scrollBottom = useCallback(() => { setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80); }, []);
  useEffect(() => { scrollBottom(); }, [msgs, thinking]);

  const micIcon  = micState === 'listening' ? 'stop-circle'      : micState === 'processing' ? 'hourglass-outline' : 'mic';
  const micColor = micState === 'listening' ? C.red              : micState === 'processing' ? C.amber             : C.blue;
  const statusLabel =
    speaking                  ? 'Speaking…'   :
    micState === 'listening'  ? 'Listening…'  :
    micState === 'processing' ? 'Processing…' : 'Property Assistant';
  const statusColor = speaking ? C.amber : micState === 'listening' ? C.red : C.green;
  const isActive = thinking || micState !== 'idle';

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="light-content" backgroundColor={C.gradA} />

        {/* ── Header ── */}
        <LinearGradient colors={[C.gradA, C.gradB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          {/* Avatar */}
          <View style={s.hAv}><RivaAvatar size={22} small /></View>
          {/* Name + status */}
          <View style={s.hInfo}>
            <Text style={s.hName}>Riva AI</Text>
            <View style={s.hStatusRow}>
              <View style={[s.sDot, { backgroundColor: statusColor }]} />
              <Text style={s.sText} numberOfLines={1}>{statusLabel}</Text>
            </View>
          </View>
          {/* Actions */}
          <View style={s.hActions}>
            <TouchableOpacity style={s.hBtn} accessibilityLabel="Property requests" onPress={() => navigation.navigate('PropertyRequests')}>
              <Ionicons name="clipboard-outline" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={s.hBtn} onPress={() => {
              setIsMuted(m => { const n = !m; if (n) Speech.stop(); Toast.show({ type: 'info', text1: n ? '🔇 Muted' : '🔊 Unmuted', position: 'top' }); return n; });
            }}>
              <Ionicons name={isMuted ? 'volume-mute' : 'volume-high-outline'} size={20} color="#fff" />
            </TouchableOpacity>
            {isActive && (
              <TouchableOpacity style={[s.hBtn, s.stopBtn]} onPress={handleStop}>
                <Ionicons name="stop-circle-outline" size={20} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.hBtn} onPress={() => setShowMore(true)}>
              <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

          {/* ── Orb hero or Chat list ── */}
          {orbMode ? (
            <View style={s.hero}>
              <PulseOrb mic={micState} speaking={speaking} />
              <Text style={s.heroTitle}>Talk to Riva AI</Text>
              <Text style={s.heroSub}>Tap mic to speak or type below</Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={msgs}
              keyExtractor={m => m.id}
              renderItem={({ item }) => <Bubble msg={item} onSpeak={speakText} onRetry={handleRetry} onCopy={handleCopy} isMuted={isMuted} onReply={sendToWebhook} />}
              contentContainerStyle={{ paddingTop: 12, paddingBottom: 6 }}
              ListFooterComponent={(thinking || micState === 'processing') ? <TypingDots /> : null}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={scrollBottom}
              style={{ backgroundColor: C.chatBg }}
            />
          )}

          {/* ── Input Bar ── */}
          <View style={[s.bar, { paddingBottom: insets.bottom + 6 }]}>
            {micState === 'listening' && (
              <View style={s.liveBanner}>
                <View style={s.liveDot} />
                <Text style={s.liveTxt} numberOfLines={2}>{liveText || 'Listening…'}</Text>
                <TouchableOpacity onPress={() => ExpoSpeechRecognitionModule.stop()} style={s.liveStop}>
                  <Ionicons name="stop" size={12} color={C.red} />
                </TouchableOpacity>
              </View>
            )}
            <View style={s.inputRow}>
              <TouchableOpacity style={[s.micBtn, { borderColor: micColor, backgroundColor: micColor + '18' }]} onPress={handleMic} disabled={micState === 'processing' || thinking} activeOpacity={0.75}>
                {micState === 'processing'
                  ? <ActivityIndicator size="small" color={micColor} />
                  : <Ionicons name={micIcon as any} size={21} color={micColor} />}
              </TouchableOpacity>
              <View style={s.inputWrap}>
                <TextInput
                  style={s.input} placeholder="Type a message…" placeholderTextColor="#9CA3AF"
                  value={inputText} onChangeText={setInputText} multiline maxLength={1000}
                  editable={micState === 'idle' && !thinking}
                />
                {thinking
                  ? <ActivityIndicator size="small" color={C.blue} style={{ marginRight: 8 }} />
                  : <TouchableOpacity style={[s.sendBtn, { backgroundColor: inputText.trim() ? C.blue : C.border }]} onPress={() => sendToWebhook(inputText)} disabled={!inputText.trim() || micState !== 'idle' || thinking} activeOpacity={0.8}>
                      <Ionicons name="arrow-up" size={16} color="#fff" />
                    </TouchableOpacity>
                }
              </View>
            </View>
            <Text style={s.powered}>Powered by Riva AI · Property Assistant</Text>
          </View>

        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Entry animation */}
      {showEntry && <EntryOverlay onDone={() => setShowEntry(false)} />}

      {/* More menu */}
      <MoreMenu visible={showMore} onClose={() => setShowMore(false)} onCopyAll={handleCopyAll} onNewChat={() => { handleNewChat(); setShowMore(false); }} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: C.chatBg },
  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 11, gap: 9 },
  backBtn:    { padding: 5 },
  hAv:        { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.38)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  hInfo:      { flex: 1, minWidth: 0 },
  hName:      { fontSize: 15, fontWeight: '700', color: '#fff' },
  hStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  sDot:       { width: 6, height: 6, borderRadius: 3 },
  sText:      { fontSize: 10, color: 'rgba(255,255,255,0.8)', flex: 1 },
  hActions:   { flexDirection: 'row', alignItems: 'center', gap: 2 },
  hBtn:       { padding: 7 },
  stopBtn:    { backgroundColor: 'rgba(239,68,68,0.25)', borderRadius: 16, paddingHorizontal: 7 },
  hero:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 16, backgroundColor: C.chatBg },
  heroTitle:  { fontSize: 21, fontWeight: '800', color: C.text, marginTop: 20, letterSpacing: 0.2 },
  heroSub:    { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 7, lineHeight: 22 },
  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 22, justifyContent: 'center' },
  chip:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.white, borderRadius: 22, paddingHorizontal: 13, paddingVertical: 8, borderWidth: 1, borderColor: C.cardBorder, elevation: 2, shadowColor: C.blue, shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  chipTxt:    { fontSize: 12.5, color: C.text, fontWeight: '500' },
  bar:        { backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 9, paddingHorizontal: 10, elevation: 8, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: -2 } },
  liveBanner: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FEF2F2', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7, marginBottom: 8, borderWidth: 1, borderColor: '#FECACA' },
  liveDot:    { width: 7, height: 7, borderRadius: 4, backgroundColor: C.red },
  liveTxt:    { flex: 1, fontSize: 12.5, color: '#DC2626', fontWeight: '500' },
  liveStop:   { padding: 4, backgroundColor: '#FEE2E2', borderRadius: 7 },
  inputRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  micBtn:     { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  inputWrap:  { flex: 1, flexDirection: 'row', alignItems: 'flex-end', backgroundColor: C.inputBg, borderRadius: 22, borderWidth: 1.5, borderColor: C.border, paddingLeft: 13, paddingRight: 6, paddingVertical: 5 },
  input:      { flex: 1, fontSize: 14.5, color: C.text, maxHeight: 100, paddingVertical: 4, paddingRight: 6 },
  sendBtn:    { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  powered:    { textAlign: 'center', fontSize: 9.5, color: '#9CA3AF', marginTop: 5, marginBottom: 1 },
});
