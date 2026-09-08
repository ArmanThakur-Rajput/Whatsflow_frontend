import { StatusBar } from 'expo-status-bar';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import React, { useState, useCallback } from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import SplashAnimation from './src/components/common/SplashAnimation';
import ConfirmModalHost from './src/components/common/ConfirmModal';
import { colors, applyTheme } from './src/theme/colors';
import { useThemeStore } from './src/store/themeStore';

SplashScreen.preventAutoHideAsync();

// PaperProvider ke liye icon renderer —
// react-native-paper ke TextInput.Icon wagera MaterialCommunityIcons use karte hain
function PaperIcon({ name, size, color }: { name: string; size: number; color: string }) {
  return <MaterialCommunityIcons name={name as any} size={size} color={color} />;
}

const toastConfig = {
  success: ({ text1, text2 }: any) => (
    <View style={{
      backgroundColor: '#2cc18a', borderRadius: 12, paddingHorizontal: 16,
      paddingVertical: 10, width: '85%', flexDirection: 'row',
      alignItems: 'center', gap: 10, elevation: 5,
    }}>
      <Ionicons name="checkmark-circle" size={20} color="white" />
      <View>
        <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>{text1}</Text>
        {text2 ? <Text style={{ color: 'white', fontSize: 11, opacity: 0.9 }}>{text2}</Text> : null}
      </View>
    </View>
  ),
  error: ({ text1, text2 }: any) => (
    <View style={{
      backgroundColor: '#EF4444', borderRadius: 12, paddingHorizontal: 16,
      paddingVertical: 10, width: '85%', flexDirection: 'row',
      alignItems: 'center', gap: 10, elevation: 5,
    }}>
      <Ionicons name="close-circle" size={20} color="white" />
      <View>
        <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>{text1}</Text>
        {text2 ? <Text style={{ color: 'white', fontSize: 11, opacity: 0.9 }}>{text2}</Text> : null}
      </View>
    </View>
  ),
  info: ({ text1, text2 }: any) => (
    <View style={{
      backgroundColor: '#3B82F6', borderRadius: 12, paddingHorizontal: 16,
      paddingVertical: 10, width: '85%', flexDirection: 'row',
      alignItems: 'center', gap: 10, elevation: 5,
    }}>
      <Ionicons name="information-circle" size={20} color="white" />
      <View>
        <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>{text1}</Text>
        {text2 ? <Text style={{ color: 'white', fontSize: 11, opacity: 0.9 }}>{text2}</Text> : null}
      </View>
    </View>
  ),
};

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  applyTheme(theme);
  return <React.Fragment key={theme.id}>{children}</React.Fragment>;
}

export default function App() {
  const navigationRef = React.useRef<any>(null);
  const [showSplash, setShowSplash] = useState(true);
  const loadTheme = useThemeStore((s) => s.loadTheme);

  React.useEffect(() => {
    // Font.loadAsync BILKUL mat karo — expo-font plugin build time pe
    // fonts ko correctly bundle karta hai apne aap.
    // Font.loadAsync karne se font galat name se register ho jaata tha
    // jisse icon ka glyph mismatch hota tha (blue circle issue).
    loadTheme().finally(() => SplashScreen.hideAsync());
  }, []);

  const handleSplashFinish = useCallback(() => setShowSplash(false), []);

  React.useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
      const screen = response.notification.request.content.data?.screen;
      if (screen && navigationRef.current?.isReady()) {
        navigationRef.current.navigate(screen);
      }
    });

    return () => responseSub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={MD3LightTheme} icon={PaperIcon}>
          <ThemeProvider>
            <StatusBar style="auto" backgroundColor={colors.white} />
            <View style={webStyles.outer}>
              <View style={webStyles.appFrame}>
                {showSplash ? (
                  <SplashAnimation onFinish={handleSplashFinish} />
                ) : (
                  <AppNavigator navigationRef={navigationRef} />
                )}
              </View>
            </View>
          </ThemeProvider>
          <Toast config={toastConfig} position="bottom" bottomOffset={80} />
          <ConfirmModalHost />
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const webStyles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: Platform.OS === 'web' ? colors.background : 'transparent',
    alignItems: 'center',
  },
  appFrame: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 480 : undefined,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 24px rgba(0,0,0,0.08)' } as any)
      : null),
  },
});
