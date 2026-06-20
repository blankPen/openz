// attachment.ts —— 附件处理工具函数
//
// 职责：
//   - 图片选择 (expo-image-picker)
//   - 文件选择 (expo-document-picker)
//   - 附件上传到 daemon
//   - 附件下载到本地
//   - 预览能力（图片直接显示，其他调用系统打开）

import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Paths, File as ExpoFile } from 'expo-file-system';
import { useSettingsStore } from '../stores/settingsStore';
import type { Attachment } from '../types/chat';

/** 日志开关 */
const LOG_ENABLED = true;
const log = (...args: unknown[]) => {
  if (LOG_ENABLED) console.log('[mobile/attachment]', ...args);
};

/**
 * 请求媒体库权限
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

/**
 * 请求相机权限
 */
export async function requestCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

/**
 * 从相册选择图片
 */
export async function pickImage(): Promise<Attachment | null> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) {
      return null;
    }

    const asset = result.assets[0];
    return {
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: asset.fileName ?? '图片',
      mimeType: asset.mimeType ?? 'image/jpeg',
      size: asset.fileSize ?? 0,
      uri: asset.uri,
    };
  } catch (err) {
    log('pickImage error:', err);
    return null;
  }
}

/**
 * 拍照
 */
export async function takePhoto(): Promise<Attachment | null> {
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) {
    log('Camera permission denied');
    return null;
  }

  try {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) {
      return null;
    }

    const asset = result.assets[0];
    return {
      id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: asset.fileName ?? `IMG_${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? 'image/jpeg',
      size: asset.fileSize ?? 0,
      uri: asset.uri,
    };
  } catch (err) {
    log('takePhoto error:', err);
    return null;
  }
}

/**
 * 选择本地文件
 */
export async function pickDocument(): Promise<Attachment | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) {
      return null;
    }

    const asset = result.assets[0];
    return {
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: asset.name ?? '文件',
      mimeType: asset.mimeType ?? 'application/octet-stream',
      size: asset.size ?? 0,
      uri: asset.uri,
    };
  } catch (err) {
    log('pickDocument error:', err);
    return null;
  }
}

/**
 * 上传附件到 daemon
 * @param attachment 要上传的附件
 * @param sessionId 会话 ID
 * @param onProgress 上传进度回调
 */
export async function uploadAttachment(
  attachment: Attachment,
  sessionId: string,
  onProgress?: (progress: number) => void,
): Promise<{ url: string } | null> {
  const serverUrl = useSettingsStore.getState().serverUrl;
  if (!serverUrl) {
    log('uploadAttachment: serverUrl not configured');
    return null;
  }

  try {
    log('Uploading attachment:', attachment.name, 'to session:', sessionId);

    // 构建 FormData
    const formData = new FormData();
    formData.append('file', {
      uri: attachment.uri,
      type: attachment.mimeType,
      name: attachment.name,
    } as any);

    // 使用 fetch + XMLHttpRequest 来支持进度回调
    return await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            log('Upload success, URL:', response.url);
            resolve({ url: response.url });
          } catch {
            reject(new Error('Failed to parse upload response'));
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload network error'));
      });

      xhr.open('POST', `${serverUrl}/sessions/${sessionId}/attachments`);
      xhr.send(formData);
    });
  } catch (err) {
    log('uploadAttachment error:', err);
    return null;
  }
}

/**
 * 下载附件到本地
 * @param url 附件 URL
 * @param filename 保存的文件名
 */
export async function downloadAttachment(url: string, filename: string): Promise<string | null> {
  try {
    const destination = new ExpoFile(Paths.document, filename);
    const result = await ExpoFile.downloadFileAsync(url, destination);
    log('Downloaded to:', result.uri);
    return result.uri;
  } catch (err) {
    log('downloadAttachment error:', err);
    return null;
  }
}

/**
 * 删除本地缓存的附件
 */
export async function deleteLocalAttachment(uri: string): Promise<void> {
  try {
    const file = new ExpoFile(uri);
    await file.delete();
  } catch (err) {
    log('deleteLocalAttachment error:', err);
  }
}

/**
 * 获取文件类型图标
 */
export function getFileTypeIcon(mimeType: string): 'image' | 'doc' | 'camera' | 'quote' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'camera';
  if (mimeType.startsWith('audio/')) return 'camera';
  return 'doc';
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
