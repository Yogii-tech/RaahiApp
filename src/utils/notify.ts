import { Alert, Platform } from 'react-native';

/**
 * Shows a message the user can actually see across both Native and Web.
 * React Native's Alert.alert is a silent no-op on react-native-web.
 */
export const notify = (title: string, message?: string, onOk?: () => void) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(message ? `${title}\n\n${message}` : title);
        onOk?.();
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
