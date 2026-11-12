import { Alert, Platform } from 'react-native';

/**
 * Displays a non-intrusive floating toast on web or Alert on native.
 * Eliminates disruptive browser alert modals and 'Suppress dialogues' triggers.
 */
let toastTimeout: any = null;

const showWebToast = (title: string, message?: string, onOk?: () => void) => {
    if (typeof document === 'undefined') return;

    // Remove any existing toast
    const existing = document.getElementById('raahi-web-toast');
    if (existing) {
        if (toastTimeout) clearTimeout(toastTimeout);
        existing.remove();
    }

    const container = document.createElement('div');
    container.id = 'raahi-web-toast';
    container.style.position = 'fixed';
    container.style.bottom = '24px';
    container.style.left = '50%';
    container.style.transform = 'translateX(-50%)';
    container.style.backgroundColor = '#1F2937';
    container.style.color = '#FFFFFF';
    container.style.padding = '12px 20px';
    container.style.borderRadius = '10px';
    container.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.2)';
    container.style.zIndex = '999999';
    container.style.maxWidth = '90vw';
    container.style.minWidth = '280px';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '4px';
    container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    container.style.fontSize = '14px';
    container.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    container.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    container.style.opacity = '0';
    container.style.pointerEvents = 'none';

    const titleEl = document.createElement('div');
    titleEl.style.fontWeight = '600';
    titleEl.style.color = '#F9FAFB';
    titleEl.innerText = title;
    container.appendChild(titleEl);

    if (message) {
        const msgEl = document.createElement('div');
        msgEl.style.color = '#D1D5DB';
        msgEl.style.fontSize = '13px';
        msgEl.style.lineHeight = '18px';
        msgEl.innerText = message;
        container.appendChild(msgEl);
    }

    document.body.appendChild(container);

    // Fade in
    requestAnimationFrame(() => {
        container.style.opacity = '1';
        container.style.transform = 'translateX(-50%) translateY(-4px)';
    });

    onOk?.();

    // Auto fade out after 3.2 seconds
    toastTimeout = setTimeout(() => {
        container.style.opacity = '0';
        container.style.transform = 'translateX(-50%) translateY(4px)';
        setTimeout(() => {
            if (container.parentNode) container.remove();
        }, 300);
    }, 3200);
};

/**
 * Shows a non-blocking toast across Web, and native Alert on mobile devices.
 */
export const notify = (title: string, message?: string, onOk?: () => void) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        showWebToast(title, message, onOk);
    } else {
        Alert.alert(title, message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
    }
};

/**
 * Shows a confirmation dialog across both Native and Web.
 */
export const confirmAction = (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText = 'OK',
    cancelText = 'Cancel',
) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        if (window.confirm(message ? `${title}\n\n${message}` : title)) {
            onConfirm();
        }
    } else {
        Alert.alert(title, message, [
            { text: cancelText, style: 'cancel' },
            { text: confirmText, onPress: onConfirm },
        ]);
    }
};
