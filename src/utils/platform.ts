// Shared helper for KeyboardAvoidingView's `behavior` prop.
//
// 'height' behavior (correct on Android) was previously also being used
// for web via `Platform.OS === 'ios' ? 'padding' : 'height'`. Web has no
// real software-keyboard resize event the way Android does, so 'height'
// behavior on web can fight with normal page scrolling and cause the
// form to visually collapse or jump. `undefined` (no automatic
// adjustment) is the correct, stable choice on web — the browser's own
// viewport handles input focus scrolling.
import { Platform } from 'react-native';

export const keyboardAvoidingBehavior = Platform.select<'padding' | 'height' | undefined>({
  ios: 'padding',
  android: 'height',
  default: undefined,
});
