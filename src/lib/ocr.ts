import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

type TextRecognitionModule = typeof import('@react-native-ml-kit/text-recognition');
type TextRecognitionApi = TextRecognitionModule['default'];

const textRecognition: TextRecognitionApi | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('@react-native-ml-kit/text-recognition') as TextRecognitionModule;
    const api = (module?.default ?? (module as unknown)) as TextRecognitionApi;
    if (!api?.recognize) {
      throw new Error('missing recognize implementation');
    }
    return api;
  } catch (error) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.info(
        '[ocr] ML Kit text recognition unavailable. Use a development build (`expo run:ios`/`expo run:android`) to enable OCR.',
        error,
      );
    }
    return null;
  }
})();

const IMAGE_SCHEME = 'file://';

const ensureFileScheme = (uri: string) =>
  Platform.OS === 'android' && !uri.startsWith(IMAGE_SCHEME) ? `${IMAGE_SCHEME}${uri}` : uri;

const toFileUri = (uri: string) =>
  Platform.OS === 'android' && !uri.startsWith(IMAGE_SCHEME) ? `${IMAGE_SCHEME}${uri}` : uri;

/**
 * Runs ML Kit text recognition on a still image captured by the VisionCamera or selected from disk.
 */
export async function recognizeTextFromImage(uri: string): Promise<string> {
  const normalizedUri = ensureFileScheme(uri);

  if (!textRecognition) {
    console.warn('[ocr] Text recognition not available, returning empty string');
    return '';
  }

  try {
    const sourceFile = new File(normalizedUri);
    const info = sourceFile.info();
    if (!info.exists) {
      throw new Error('File missing or inaccessible');
    }
  } catch (error) {
    throw new Error(`File not accessible for OCR: ${String(error)}`);
  }

  let preparedUri = normalizedUri;

  try {
    const manipulated = await manipulateAsync(
      normalizedUri,
      [],
      {
        compress: 0.9,
        format: SaveFormat.PNG,
      },
    );
    const manipulatedUri = toFileUri(manipulated.uri);
    const processedFile = new File(manipulatedUri);
    const processedInfo = processedFile.info();
    if (!processedInfo.exists) {
      throw new Error('Processed file missing or inaccessible');
    }
    preparedUri = manipulatedUri;
  } catch (error) {
    // Manipulation is a best-effort improvement only.
    console.warn('[ocr] Manipulation skipped:', error);
  }

  try {
    const result = await textRecognition.recognize(preparedUri);

    if (typeof result.text === 'string' && result.text.trim().length > 0) {
      return result.text.trim();
    }

    const lines = result.blocks
      ?.flatMap((block) => block.lines?.map((line) => line.text ?? '').filter(Boolean) ?? [])
      .filter(Boolean);

    return lines?.join('\n').trim() ?? '';
  } catch (error) {
    console.error('[ocr] Failed to extract text', error);
    throw error;
  }
}
