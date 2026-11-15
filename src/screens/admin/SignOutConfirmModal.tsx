import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useBrowserBack } from '../../utils/browserHistory';
import { notify } from '../../utils/notify';

export interface SignOutConfirmModalProps {
    visible: boolean;
    isDark?: boolean;
    isSigningOut?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

/**
 * Manages sign-out confirmation modal visibility and single-flight logout execution
 * so rapid double-taps or dismissals mid-logout cannot trigger duplicate logouts.
 */
export function useSignOutConfirmation(logout: () => Promise<void> | void) {
    const [visible, setVisible] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const signingOutRef = useRef(false);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const openConfirm = useCallback(() => {
        if (signingOutRef.current) return;
        setVisible(true);
    }, []);

    const cancelSignOut = useCallback(() => {
        if (signingOutRef.current) return;
        setVisible(false);
    }, []);

    const confirmSignOut = useCallback(async () => {
        if (signingOutRef.current) return;
        signingOutRef.current = true;
        setIsSigningOut(true);
        try {
            await logout();
            if (mountedRef.current) {
                setVisible(false);
            }
        } catch (err: any) {
            console.error('Sign out failed:', err);
            notify('Sign Out Failed', err?.message || 'Unable to sign out right now. Please try again.');
        } finally {
            signingOutRef.current = false;
            if (mountedRef.current) {
                setIsSigningOut(false);
            }
        }
    }, [logout]);

    useBrowserBack(visible, cancelSignOut);

    return {
        visible,
        isSigningOut,
        openConfirm,
        cancelSignOut,
        confirmSignOut,
    };
}

/**
 * Cross-platform themed confirmation modal for signing out of the Admin Portal.
 * Replaces immediate logout calls and native Alert.alert / window.confirm dialogs.
 */
export default function SignOutConfirmModal({
    visible,
    isDark = true,
    isSigningOut = false,
    onCancel,
    onConfirm,
}: SignOutConfirmModalProps) {
    const palette = isDark
        ? {
              cardBg: '#1F2937',
              cardBorder: 'rgba(239, 68, 68, 0.35)',
              iconBg: 'rgba(220, 38, 38, 0.14)',
              iconBorder: 'rgba(239, 68, 68, 0.3)',
              title: '#F9FAFB',
              message: '#9CA3AF',
              cancelBg: '#374151',
              cancelText: '#F9FAFB',
          }
        : {
              cardBg: '#FFFFFF',
              cardBorder: '#E5E7EB',
              iconBg: 'rgba(220, 38, 38, 0.08)',
              iconBorder: 'rgba(220, 38, 38, 0.22)',
              title: '#111827',
              message: '#4B5563',
              cancelBg: '#E5E7EB',
              cancelText: '#1F2937',
          };

    const webCursor =
        Platform.OS === 'web'
            ? ({ cursor: isSigningOut ? 'not-allowed' : 'pointer' } as any)
            : undefined;

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => {
                if (!isSigningOut) onCancel();
            }}
        >
            <View style={styles.modalBackdrop}>
                <TouchableOpacity
                    testID="admin-signout-backdrop"
                    style={styles.backdropDismissArea}
                    activeOpacity={1}
                    onPress={onCancel}
                    disabled={isSigningOut}
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss sign out confirmation"
                />
                <View
                    style={[
                        styles.modalCard,
                        { backgroundColor: palette.cardBg, borderColor: palette.cardBorder },
                    ]}
                    accessibilityViewIsModal={true}
                >
                    <View
                        style={[
                            styles.iconBadge,
                            { backgroundColor: palette.iconBg, borderColor: palette.iconBorder },
                        ]}
                    >
                        <Text style={styles.iconText}>🚪</Text>
                    </View>
                    <Text style={[styles.title, { color: palette.title }]}>
                        Sign Out?
                    </Text>
                    <Text style={[styles.message, { color: palette.message }]}>
                        Do you really want to logout of the Admin Portal? You will need to sign in again to access admin controls.
                    </Text>
                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            testID="admin-signout-cancel-btn"
                            style={[
                                styles.button,
                                { backgroundColor: palette.cancelBg },
                                webCursor,
                                isSigningOut && styles.buttonDisabled,
                            ]}
                            onPress={onCancel}
                            disabled={isSigningOut}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel="No, cancel sign out"
                        >
                            <Text style={[styles.cancelButtonText, { color: palette.cancelText }]}>
                                No
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            testID="admin-signout-confirm-btn"
                            style={[
                                styles.button,
                                styles.confirmButton,
                                webCursor,
                                isSigningOut && styles.buttonDisabled,
                            ]}
                            onPress={onConfirm}
                            disabled={isSigningOut}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel="Yes, Sign Out"
                        >
                            {isSigningOut ? (
                                <ActivityIndicator color="#FFFFFF" size="small" />
                            ) : (
                                <Text style={styles.confirmButtonText}>Yes, Sign Out</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        zIndex: 9999,
    },
    backdropDismissArea: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 0,
    },
    modalCard: {
        position: 'relative',
        zIndex: 1,
        width: '100%',
        maxWidth: 400,
        borderRadius: 16,
        borderWidth: 1,
        padding: 24,
        alignItems: 'center',
        ...(Platform.OS === 'web'
            ? ({ boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45)' } as any)
            : {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.35,
                  shadowRadius: 20,
                  elevation: 12,
              }),
    },
    iconBadge: {
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
    },
    iconText: {
        fontSize: 24,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    message: {
        fontSize: 13,
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 19,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 22,
        alignSelf: 'stretch',
    },
    button: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmButton: {
        backgroundColor: '#DC2626',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    cancelButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    confirmButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
});
