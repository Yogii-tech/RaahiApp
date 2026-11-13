import { Alert, Platform } from 'react-native';

/**
 * Displays a non-intrusive floating toast on web or Alert on native.
 * Eliminates disruptive browser alert modals and 'Suppress dialogues' triggers.
 */
let toastTimeout: ReturnType<typeof setTimeout> | null = null;
let fadeOutTimeout: ReturnType<typeof setTimeout> | null = null;

const clearToastTimers = () => {
    if (toastTimeout) {
        clearTimeout(toastTimeout);
        toastTimeout = null;
    }
    if (fadeOutTimeout) {
        clearTimeout(fadeOutTimeout);
        fadeOutTimeout = null;
    }
};

const showWebToast = (title: string, message?: string, onOk?: () => void) => {
    if (typeof document === 'undefined') return;

    // Remove any existing toast and cancel pending timers
    clearToastTimers();
    const existing = document.getElementById('raahi-web-toast');
    if (existing) {
        existing.remove();
    }

    const container = document.createElement('div');
    container.id = 'raahi-web-toast';
    container.style.position = 'fixed';
    container.style.top = '16px';
    container.style.left = '50%';
    container.style.transform = 'translateX(-50%) translateY(-10px)';
    container.style.backgroundColor = 'rgba(17, 24, 39, 0.95)';
    container.style.color = '#FFFFFF';
    container.style.padding = '8px 16px';
    container.style.borderRadius = '9999px';
    container.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15)';
    container.style.zIndex = '999999';
    container.style.maxWidth = '92vw';
    container.style.width = 'max-content';
    container.style.display = 'flex';
    container.style.flexDirection = 'row';
    container.style.alignItems = 'center';
    container.style.gap = '10px';
    container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    container.style.fontSize = '13px';
    container.style.border = '1px solid rgba(255, 255, 255, 0.12)';
    container.style.backdropFilter = 'blur(8px)';
    container.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    container.style.opacity = '0';
    container.style.pointerEvents = 'auto';
    container.style.cursor = 'default';

    const textWrap = document.createElement('div');
    textWrap.style.display = 'flex';
    textWrap.style.flexDirection = 'row';
    textWrap.style.alignItems = 'center';
    textWrap.style.gap = '6px';
    textWrap.style.flexWrap = 'wrap';

    const titleEl = document.createElement('span');
    titleEl.style.fontWeight = '600';
    titleEl.style.color = '#F9FAFB';
    titleEl.innerText = title;
    textWrap.appendChild(titleEl);

    if (message) {
        const msgEl = document.createElement('span');
        msgEl.style.color = '#D1D5DB';
        msgEl.style.fontSize = '12px';
        msgEl.innerText = `• ${message}`;
        textWrap.appendChild(msgEl);
    }
    container.appendChild(textWrap);

    const closeBtn = document.createElement('button');
    closeBtn.innerText = '✕';
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = 'none';
    closeBtn.style.color = 'rgba(255, 255, 255, 0.6)';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontSize = '12px';
    closeBtn.style.padding = '0 0 0 4px';
    closeBtn.style.display = 'flex';
    closeBtn.style.alignItems = 'center';
    closeBtn.onclick = () => {
        clearToastTimers();
        container.style.opacity = '0';
        container.style.transform = 'translateX(-50%) translateY(-10px)';
        fadeOutTimeout = setTimeout(() => {
            fadeOutTimeout = null;
            if (container.parentNode) container.remove();
        }, 200);
    };
    container.appendChild(closeBtn);

    document.body.appendChild(container);

    // Fade in
    requestAnimationFrame(() => {
        container.style.opacity = '1';
        container.style.transform = 'translateX(-50%) translateY(0)';
    });

    onOk?.();

    // Auto fade out after 3.2 seconds
    toastTimeout = setTimeout(() => {
        toastTimeout = null;
        container.style.opacity = '0';
        container.style.transform = 'translateX(-50%) translateY(-10px)';
        fadeOutTimeout = setTimeout(() => {
            fadeOutTimeout = null;
            if (container.parentNode) container.remove();
        }, 200);
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
