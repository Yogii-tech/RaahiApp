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
import TrustedContactsScreen from './TrustedContactsScreen';


const AccountScreen: React.FC = () => {
    const { isDark, colors } = useTheme();
    const { user, logout } = useAuth();
    const [view, setView] = useState<'main' | 'trusted'>('main');
    const [logoutVisible, setLogoutVisible] = useState(false); // New state for logout modal
    const ratingColor = isDark ? '#FFC107' : '#FFB300';

    // New functions for logout modal
    const confirmLogout = () => {
        setLogoutVisible(false);
        logout();
    };

    const handleLogoutPress = () => setLogoutVisible(true);

    const optionItems = [
        { icon: '💳', title: 'Payment Methods' },
        { icon: '📇', title: 'Trusted Contacts', action: () => setView('trusted') },
        { icon: '🌐', title: 'Language' },
        { icon: '🆘', title: 'Support', color: '#C62828' },
        { icon: '🚪', title: 'Logout', action: handleLogoutPress, color: '#C62828' }, // Updated action
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
                        {user?.phone_number || 'No number'}
                    </Text>
                    <View style={styles.spacer6} />
                    <View style={[styles.roleBadge, { backgroundColor: user?.role === 'driver' ? '#E65100' : colors.primary }]}>
                        <Text style={styles.roleBadgeText}>
                            {(user?.role || 'passenger').toUpperCase()}
                        </Text>
                    </View>
                    <View style={styles.spacer8} />
                    <View style={styles.ratingRow}>
                        <Text style={[styles.star, { color: ratingColor }]}>⭐</Text>
                        <Text style={[styles.ratingText, { color: ratingColor }]}>
                            4.8 rating
                        </Text>
                    </View>
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
                        {item.title !== 'Logout' && (
                            <Text style={[styles.chevron, { color: colors.subtextColor }]}>
                                ›
                            </Text>
                        )}
                    </TouchableOpacity>
                    {index < optionItems.length - 1 && <View style={styles.spacer14} />}
                </React.Fragment>
            ))}

            <Modal
                transparent={true}
                visible={logoutVisible}
                animationType="fade"
                onRequestClose={() => setLogoutVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}>
                        <Text style={[styles.modalTitle, { color: colors.textColor }]}>Logout</Text>
                        <Text style={[styles.modalText, { color: colors.subtextColor }]}>Are you sure you want to log out?</Text>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setLogoutVisible(false)}>
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.confirmButton]}
                                onPress={confirmLogout}>
                                <Text style={styles.confirmButtonText}>Logout</Text>
                            </TouchableOpacity>
                        </View>
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
});

export default AccountScreen;
