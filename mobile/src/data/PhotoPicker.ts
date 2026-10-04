import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { Photo } from '../models/Usuario';
export async function pickPhoto(): Promise<Photo | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Permite acceso a tus fotos desde los ajustes del teléfono.');
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
  const asset = result.assets?.[0];
  if (result.canceled || !asset) return null;
  const context = ImageManipulator.manipulate(asset.uri);
  context.resize(asset.width >= asset.height ? { width: 640 } : { height: 640 });
  const rendered = await context.renderAsync();
  const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return { uri: image.uri, name: 'perfil.jpg', type: 'image/jpeg' };
}
