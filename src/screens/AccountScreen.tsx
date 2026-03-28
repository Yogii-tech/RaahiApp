import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Alert,
    Platform,
    Modal,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage, LanguageType } from '../context/LanguageContext';

const API_BASE = 'http://localhost:8081';
import TrustedContactsScreen from './TrustedContactsScreen';


const AccountScreen: React.FC = () => {
    const { isDark, colors } = useTheme();
    const { user, setUser, token, logout } = useAuth();
    const { t, language, setLanguage } = useLanguage();
    const [view, setView] = useState<'main' | 'trusted'>('main');
    const [logoutVisible, setLogoutVisible] = useState(false);
    const [languageVisible, setLanguageVisible] = useState(false);
    const ratingColor = isDark ? '#FFC107' : '#FFB300';

    // New functions for logout modal
    const confirmLogout = () => {
        setLogoutVisible(false);
        logout();
    };

    const handleLogoutPress = () => setLogoutVisible(true);

    const handleLanguagePress = () => setLanguageVisible(true);

    const handleSelectLanguage = async (lang: LanguageType) => {
        setLanguage(lang);
        setLanguageVisible(false);

        // Sync with backend if logged in
        if (token && user) {
            try {
                const response = await fetch(`${API_BASE}/api/user/profile`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        name: user.name,
                        role: user.role,
                        language: lang
                    }),
                });

                if (response.ok) {
                    // Update local user state to keep in sync
                    setUser({ ...user, language: lang });
                }
            } catch (err) {
                console.error('Failed to sync language to backend:', err);
            }
        }
    };

    const optionItems = [
        { icon: '💳', title: t('account.paymentMethods') },
        { icon: '📇', title: t('account.trustedContacts'), action: () => setView('trusted') },
        { icon: '🌐', title: t('account.language'), action: handleLanguagePress },
        { icon: '🆘', title: t('account.support'), color: '#C62828' },
        { icon: '🚪', title: t('account.logout'), action: handleLogoutPress, color: '#C62828' },
    ];

    if (view === 'trusted') {
        return <TrustedContactsScreen onBack={() => setView('main')} />;
    }

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.background }]}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            {/* Profile Card */}
            <View
                style={[
                    styles.profileCard,
                    {
                        backgroundColor: colors.cardColor,
                        borderColor: colors.borderColor,
                    },
                ]}>
                <View
                    style={[
                        styles.avatar,
                        {
                            backgroundColor: isDark ? '#181F2A' : '#F8F9FF',
                        },
                    ]}>
                    <Text style={[styles.avatarIcon, { color: colors.accentColor }]}>
                        👤
                    </Text>
                </View>

                <View style={styles.profileInfo}>
                    <Text style={[styles.profileName, { color: colors.textColor }]}>
                        {user?.name || 'User'}
                    </Text>
                    <View style={styles.spacer6} />
                    <Text style={[styles.profilePhone, { color: colors.accentColor }]}>
                        {user?.phone_number || t('account.noNumber')}
                    </Text>
                    <View style={styles.spacer6} />
                    <View style={[styles.roleBadge, { backgroundColor: user?.role === 'driver' ? '#E65100' : colors.primary }]}>
                        <Text style={styles.roleBadgeText}>
                            {(user?.role === 'driver' ? t('account.driver') : t('account.passenger')).toUpperCase()}
                        </Text>
                    </View>
                    {user?.role === 'driver' && (
                        <>
                            <View style={styles.spacer8} />
                            <View style={styles.ratingRow}>
                                <Text style={[styles.star, { color: ratingColor }]}>⭐</Text>
                                <Text style={[styles.ratingText, { color: ratingColor }]}>
                                    4.8 {t('account.rating')}
                                </Text>
                            </View>
                        </>
                    )}
                </View>
            </View>


            <View style={styles.spacer28} />

            {/* Option Tiles */}
            {optionItems.map((item, index) => (
                <React.Fragment key={item.title}>
                    <TouchableOpacity
                        style={[
                            styles.optionTile,
                            {
                                backgroundColor: colors.cardColor,
                                borderColor: colors.borderColor,
                            },
                        ]}
                        activeOpacity={0.7}
                        onPress={item.action}>
                        <Text
                            style={[
                                styles.optionIcon,
                                { color: item.color ?? '#FFEA00' },
                            ]}>
                            {item.icon}
                        </Text>
                        <Text style={[styles.optionTitle, { color: item.color ?? colors.textColor }]}>
                            {item.title}
                        </Text>
                        {item.title !== t('account.logout') && (
                            <Text style={[styles.chevron, { color: colors.subtextColor }]}>
                                ›
                            </Text>
                        )}
                    </TouchableOpacity>
                    {index < optionItems.length - 1 && <View style={styles.spacer14} />}
                </React.Fragment>
            ))}

            {/* Logout Modal */}
            <Modal
                transparent={true}
                visible={logoutVisible}
                animationType="fade"
                onRequestClose={() => setLogoutVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}>
                        <Text style={[styles.modalTitle, { color: colors.textColor }]}>{t('account.logoutTitle')}</Text>
                        <Text style={[styles.modalText, { color: colors.subtextColor }]}>{t('account.logoutConfirm')}</Text>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setLogoutVisible(false)}>
                                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.confirmButton]}
                                onPress={confirmLogout}>
                                <Text style={styles.confirmButtonText}>{t('account.logout')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Language Selection Modal */}
            <Modal
                transparent={true}
                visible={languageVisible}
                animationType="fade"
                onRequestClose={() => setLanguageVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}>
                        <Text style={[styles.modalTitle, { color: colors.textColor, marginBottom: 20 }]}>{t('account.languageModalTitle')}</Text>

                        <TouchableOpacity
                            style={[
                                styles.languageOption,
                                language === 'en' && { borderColor: colors.primary, backgroundColor: 'rgba(91, 79, 255, 0.1)' }
                            ]}
                            onPress={() => handleSelectLanguage('en')}>
                            <Text style={[styles.languageOptionText, { color: colors.textColor }]}>English</Text>
                            {language === 'en' && <Text style={{ color: colors.primary }}>✓</Text>}
                        </TouchableOpacity>

                        <View style={styles.spacer14} />

                        <TouchableOpacity
                            style={[
                                styles.languageOption,
                                language === 'hi' && { borderColor: colors.primary, backgroundColor: 'rgba(91, 79, 255, 0.1)' }
                            ]}
                            onPress={() => handleSelectLanguage('hi')}>
                            <Text style={[styles.languageOptionText, { color: colors.textColor }]}>हिंदी (Hindi)</Text>
                            {language === 'hi' && <Text style={{ color: colors.primary }}>✓</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{ padding: 16, marginTop: 10 }}
                            onPress={() => setLanguageVisible(false)}>
                            <Text style={{ color: colors.subtextColor, fontWeight: 'bold' }}>{t('common.cancel')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
};


const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 16,
    },
    profileCard: {
        borderRadius: 20,
        borderWidth: 1,
        padding: 24,
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 76,
        height: 76,
        borderRadius: 38,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarIcon: {
        fontSize: 40,
    },
    profileInfo: {
        marginLeft: 24,
        flex: 1,
    },
    profileName: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    profilePhone: {
        fontSize: 16,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    star: {
        fontSize: 16,
        marginRight: 4,
    },
    ratingText: {
        fontWeight: 'bold',
        fontSize: 14,
    },
    optionTile: {
        borderRadius: 16,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        ...Platform.select({
            web: {
                cursor: 'pointer',
            } as any,
        }),
    },
    optionIcon: {
        fontSize: 24,
        marginRight: 16,
    },
    optionTitle: {
        fontWeight: 'bold',
        fontSize: 16,
        flex: 1,
    },
    chevron: {
        fontSize: 28,
        fontWeight: '300',
    },
    roleBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    roleBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    spacer6: { height: 6 },
    spacer8: { height: 8 },
    spacer14: { height: 14 },
    spacer28: { height: 28 },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    modalText: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 28,
        lineHeight: 22,
    },
    modalButtons: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    confirmButton: {
        backgroundColor: '#C62828',
    },
    cancelButtonText: {
        color: '#888',
        fontWeight: 'bold',
        fontSize: 16,
    },
    confirmButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    languageOption: {
        width: '100%',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    languageOptionText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default AccountScreen;
