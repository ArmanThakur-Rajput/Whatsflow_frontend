import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export async function registerPushToken(): Promise<string | null> {
  // Simulator pe kaam nahi karta
  if (!Device.isDevice) {
    console.log('Push notifications only work on physical device');
    return null;
  }

  // Android channel setup
  if (Platform.OS === 'android') {
    // Purana channel delete karo taaki sound update ho
    await Notifications.deleteNotificationChannelAsync('default');

    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2cc18a',
      sound: 'sound', // ✅ assets/sounds/sound.wav → sirf 'sound' likhna hai
    });
  }

  // Permission maango
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Permission denied for push notifications');
    return null;
  }

  // ✅ FCM Native Token (seedha Firebase ka token, Expo wrapper nahi)
  // Android => FCM token | iOS => APNs token
  const deviceToken = await Notifications.getDevicePushTokenAsync();
  console.log('📲 FCM Device Token:', deviceToken.data);

  return deviceToken.data;
}
