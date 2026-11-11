import { Alert, Platform } from 'react-native';
import { API_BASE } from '../apiConfig';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // must match backend limit (10MB)
const COMPRESS_ABOVE_BYTES = 1.5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 2000;
const UPLOAD_TIMEOUT_MS = 60000;

/**
 * Shows a message the user can actually see.
 * NOTE: React Native's Alert.alert is a silent no-op on react-native-web, which is
 * why upload failures used to be invisible in the browser.
 */
export const notify = (title: string, message: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`${title}\n\n${message}`);
    } else {
        Alert.alert(title, message);
    }
};

/**
 * Downscales large photos (typical phone camera shots are 3-12MB) so the upload is fast
 * on mobile networks and stays under the server limit. Falls back to the original file
 * if the browser cannot decode the image.
 */
const compressImage = (file: File): Promise<File> =>
    new Promise(resolve => {
        if (!file.type.startsWith('image/') || file.size <= COMPRESS_ABOVE_BYTES) {
            resolve(file);
            return;
        }
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            try {
                const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.width, img.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(file);
                    return;
                }
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(
                    blob => {
                        URL.revokeObjectURL(url);
                        if (blob && blob.size < file.size) {
                            const baseName = (file.name || 'document').replace(/\.[^.]+$/, '');
                            resolve(new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }));
                        } else {
                            resolve(file);
                        }
                    },
                    'image/jpeg',
                    0.85,
                );
            } catch {
                URL.revokeObjectURL(url);
                resolve(file);
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(file);
        };
        img.src = url;
    });

/** Uploads one file to the backend and returns its public URL. Throws Error with a user-readable message. */
export const uploadDocumentFile = async (file: File, authToken: string | null): Promise<string> => {
    if (!authToken) {
        throw new Error('Your session has expired. Please log in again.');
    }

    const prepared = await compressImage(file);
    if (prepared.size > MAX_UPLOAD_BYTES) {
        throw new Error('File is larger than 10MB. Please choose a smaller file.');
    }

    const formData = new FormData();
    formData.append('file', prepared, prepared.name || 'document');

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS) : null;

    let response: Response;
    try {
        response = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${authToken}` },
            body: formData,
            signal: controller ? controller.signal : undefined,
        });
    } catch (err: any) {
        if (err?.name === 'AbortError') {
            throw new Error('Upload timed out. Please check your connection and try again.');
        }
        throw new Error('Could not reach the server. Please check your internet connection and try again.');
    } finally {
        if (timer) clearTimeout(timer);
    }

    let data: any = null;
    try {
        data = await response.json();
    } catch {
        // non-JSON response (e.g. proxy error page)
    }

    if (!response.ok) {
        if (response.status === 429) {
            throw new Error('Too many uploads. Please wait a minute and try again.');
        }
        if (response.status === 401) {
            throw new Error(data?.error || 'Your session has expired. Please log in again.');
        }
        throw new Error(data?.error || `Upload failed (error ${response.status}). Please try again.`);
    }
    if (!data?.url) {
        throw new Error('Upload failed: server did not return a file URL.');
    }
    return data.url as string;
};

/**
 * Opens the browser file picker (gallery/camera/files on mobile, file dialog on desktop),
 * uploads the chosen file and resolves with its URL (or null if the user cancelled).
 * The <input> is attached to the DOM, which mobile Safari/Chrome require to reliably
 * fire the change event.
 */
export const pickAndUploadDocument = (
    authToken: string | null,
    onUploadStart?: () => void,
    onUploadEnd?: () => void,
): Promise<string | null> =>
    new Promise(resolve => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,application/pdf';
        input.style.position = 'fixed';
        input.style.left = '-9999px';
        input.style.opacity = '0';
        document.body.appendChild(input);

        const cleanup = () => {
            if (input.parentNode) input.parentNode.removeChild(input);
        };

        input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            if (!file) {
                cleanup();
                resolve(null);
                return;
            }
            onUploadStart?.();
            try {
                const url = await uploadDocumentFile(file, authToken);
                resolve(url);
            } catch (err: any) {
                notify('Upload failed', err?.message || 'Upload failed. Please try again.');
                resolve(null);
            } finally {
                onUploadEnd?.();
                cleanup();
            }
        });
        input.addEventListener('cancel', () => {
            cleanup();
            resolve(null);
        });

        input.click();
    });

