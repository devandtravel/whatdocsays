import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import Constants from 'expo-constants';
import type { Camera as VisionCamera, PhotoFile } from 'react-native-vision-camera';
import * as ImagePicker from 'expo-image-picker';
import { recognizeTextFromImage } from '../lib/ocr';
import { useAppStore } from '../store';
import { theme } from '../theme';

type VisionCameraModule = typeof import('react-native-vision-camera');
type UseCameraPermissionState = ReturnType<VisionCameraModule['useCameraPermission']>;
type UseCameraDevice = VisionCameraModule['useCameraDevice'];

const visionCameraModule: VisionCameraModule | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-vision-camera') as VisionCameraModule;
  } catch (error) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.info(
        '[capture] Vision Camera unavailable. Use a development build (`expo run:ios`/`expo run:android`) to enable camera capture.',
        error,
      );
    }
    return null;
  }
})();

const unavailablePermissionState = {
  hasPermission: false,
  requestPermission: async () => false,
  granted: false,
  denied: true,
  restricted: false,
  canAskAgain: false,
  limited: false,
} as UseCameraPermissionState;

const useUnavailableCameraPermission = () => unavailablePermissionState;

const useSafeCameraPermission = visionCameraModule?.useCameraPermission ?? useUnavailableCameraPermission;
const useSafeCameraDevice: UseCameraDevice =
  visionCameraModule?.useCameraDevice ?? (() => undefined as ReturnType<UseCameraDevice>);

const CameraComponent = visionCameraModule?.Camera ?? null;

const ensureFileUri = (photo: PhotoFile) => {
  const path = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
  return Platform.OS === 'ios' ? photo.path : path;
};

export default function CaptureScreen() {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Add a small delay to ensure everything is loaded
    const timer = setTimeout(() => setIsLoading(false), 100);
    return () => clearTimeout(timer);
  }, []);

  const device = useSafeCameraDevice('back');
  const { hasPermission, requestPermission } = useSafeCameraPermission();
  const cameraRef = useRef<VisionCamera>(null);
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraTimeout, setCameraTimeout] = useState(false);

  const setDraftText = useAppStore((state) => state.setDraftText);
  const setDraftPlans = useAppStore((state) => state.setDraftPlans);

  // Check if running on simulator - more reliable detection
  const isSimulator = Platform.OS === 'ios' && !Constants.isDevice;
  const cameraSupported = Boolean(CameraComponent) && !isSimulator;

  useEffect(() => {
    if (cameraSupported && !hasPermission) {
      requestPermission();
    }
  }, [cameraSupported, hasPermission, requestPermission]);

  // Add timeout for camera loading on simulator
  useEffect(() => {
    if (isSimulator) {
      const timer = setTimeout(() => {
        setCameraTimeout(true);
      }, 2000); // 2 second timeout
      return () => clearTimeout(timer);
    }
  }, [isSimulator]);

  const handleOcr = useCallback(
    async (uri: string) => {
      setIsProcessing(true);
      setErrorMessage(null);
      try {
        const text = await recognizeTextFromImage(uri);
        if (!text) {
          setErrorMessage('No text detected. Try again with clearer lighting.');
          return;
        }
        setDraftText(text);
        setDraftPlans([]);
        router.push('/review');
      } catch (error) {
        console.error('[capture] OCR failed', error);
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Unable to recognise text. Please try again.';
        setErrorMessage(message);
      } finally {
        setIsProcessing(false);
      }
    },
    [router, setDraftPlans, setDraftText],
  );

  const capturePhoto = useCallback(async () => {
    if (isProcessing) {
      return;
    }

    if (!CameraComponent) {
      setErrorMessage('Camera capture requires a development build. Use the image picker instead.');
      return;
    }

    try {
      // Request camera permission first
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant access to your camera to take photos.',
          [{ text: 'OK' }]
        );
        return;
      }

      const photo = await cameraRef.current?.takePhoto({ flash: 'off' });
      if (!photo) {
        return;
      }
      await handleOcr(ensureFileUri(photo));
    } catch (error) {
      console.error('[capture] Failed to capture photo', error);
      Alert.alert('Capture failed', 'Please try again.');
    }
  }, [handleOcr, isProcessing]);

  const pickFromLibrary = useCallback(async () => {
    try {
      // Request permission first
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant access to your photo library to select images.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images' as const,
        allowsEditing: false,
        quality: 0.8,
        base64: false,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.uri) {
        return;
      }

      await handleOcr(asset.uri);
    } catch (error) {
      console.error('[pickFromLibrary] Failed to pick image', error);
      Alert.alert('Image picker failed', 'Please try again.');
    }
  }, [handleOcr]);

  const cameraReady = cameraSupported && !!device && hasPermission && !cameraTimeout;
  const awaitingPermission = cameraSupported && !hasPermission && !cameraTimeout;

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={{ color: '#fff', marginTop: theme.spacing.md }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <Stack.Screen options={{ headerShown: false }} />
      {cameraReady && CameraComponent ? (
        <CameraComponent
          ref={cameraRef}
          style={{ flex: 1 }}
          device={device!}
          isActive={!isProcessing}
          photo
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg }}>
          <Text style={{ color: '#fff', textAlign: 'center', marginBottom: theme.spacing.md }}>
            {isSimulator || cameraTimeout
              ? 'Camera is not available on simulator. Use "Pick image/PDF" to select an image from your device.'
              : cameraSupported
              ? awaitingPermission
                ? 'Camera permission is required to scan prescriptions.'
                : 'Loading camera…'
              : 'Camera capture requires a development build with the Vision Camera module. You can still pick an existing image below.'}
          </Text>
          {awaitingPermission ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => requestPermission()}
              style={{
                paddingVertical: theme.spacing.sm,
                paddingHorizontal: theme.spacing.lg,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.primary,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Grant access</Text>
            </Pressable>
          ) : null}
        </View>
      )}
      <View
        style={{
          padding: theme.spacing.lg,
          backgroundColor: 'rgba(0,0,0,0.75)',
        }}
      >
        {errorMessage ? (
          <Text style={{ color: theme.colors.warning, marginBottom: theme.spacing.sm }}>{errorMessage}</Text>
        ) : null}
        {isProcessing ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <ActivityIndicator color="#fff" />
            <Text style={{ color: '#fff' }}>Processing…</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            {cameraSupported ? <CaptureButton label="Capture" onPress={capturePhoto} /> : null}
            <CaptureButton
              label="Pick image/PDF"
              onPress={pickFromLibrary}
              variant={isSimulator || cameraTimeout || !cameraSupported ? 'solid' : 'outline'}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

type CaptureButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'solid' | 'outline';
};

const CaptureButton = ({ label, onPress, variant = 'solid' }: CaptureButtonProps) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    style={{
      flex: 1,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: variant === 'outline' ? 1 : 0,
      borderColor: '#fff',
      backgroundColor: variant === 'solid' ? theme.colors.accent : 'transparent',
    }}
  >
    <Text style={{ color: '#fff', fontWeight: '600' }}>{label}</Text>
  </Pressable>
);
