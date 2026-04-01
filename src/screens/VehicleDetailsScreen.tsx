import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    Modal,
    Image,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

import { API_BASE } from '../apiConfig';

const VehicleDetailsScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { t } = useLanguage();
    const [previewVisible, setPreviewVisible] = useState(false);
    const [currentDoc, setCurrentDoc] = useState<{ label: string, url: string } | null>(null);

    const vehicle = user?.vehicle;

    const handleViewDocument = (label: string, url: string) => {
        if (!url) {
            Alert.alert(t('common.error'), 'No document uploaded');
            return;
        }

        // Prepend API_BASE if it's a relative path from the server
        const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
        setCurrentDoc({ label, url: fullUrl });
        setPreviewVisible(true);
    };

    if (!vehicle) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: colors.textColor }}>No vehicle details found.</Text>
                <TouchableOpacity onPress={onBack} style={{ marginTop: 20 }}>
                    <Text style={{ color: colors.primary }}>{t('common.back')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const docs = [
        { label: t('login.uploadDL'), key: 'dl_url', url: vehicle.dl_url },
        { label: t('login.uploadRC'), key: 'rc_url', url: vehicle.rc_url },
        { label: t('login.uploadPollution'), key: 'pollution_url', url: vehicle.pollution_url },
        { label: t('login.uploadVehicleImg'), key: 'vehicle_image_url', url: vehicle.vehicle_image_url },
        { label: t('login.uploadOwnership'), key: 'ownership_url', url: vehicle.ownership_url },
    ];

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Text style={[styles.backText, { color: colors.primary }]}>{t('common.back')}</Text>
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.textColor }]}>{t('account.vehicleDetails')}</Text>
            </View>

            <View style={styles.content}>
                <View style={[styles.infoCard, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}>
                    <DetailRow label={t('vehicle.nameLabel')} value={vehicle.vehicle_name} color={colors.textColor} subColor={colors.subtextColor} />
                    <DetailRow label={t('vehicle.typeLabel')} value={vehicle.vehicle_type} color={colors.textColor} subColor={colors.subtextColor} />
                    <DetailRow label={t('login.seatingArrangement')} value={t(`layout.${vehicle.seating_layout}` as any)} color={colors.textColor} subColor={colors.subtextColor} />
                    <DetailRow label={t('vehicle.seatsLabel')} value={vehicle.seats.toString()} color={colors.textColor} subColor={colors.subtextColor} />
                    <DetailRow label={t('vehicle.numberLabel')} value={vehicle.vehicle_number} color={colors.textColor} subColor={colors.subtextColor} last />
                </View>

                <View style={styles.spacer24} />
                <Text style={[styles.sectionTitle, { color: colors.textColor }]}>UPLOADED DOCUMENTS</Text>
                <View style={styles.spacer12} />

                {docs.map((doc, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[styles.docRow, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}
                        onPress={() => handleViewDocument(doc.label, doc.url)}
                    >
                        <View style={styles.docInfo}>
                            <Text style={[styles.docLabel, { color: colors.textColor }]}>{doc.label}</Text>
                            <Text style={[styles.docFilename, { color: colors.subtextColor }]} numberOfLines={1}>
                                {doc.url ? (doc.url.includes('/') ? doc.url.split('/').pop() : doc.url) : 'Not uploaded'}
                            </Text>
                        </View>
                        <Text style={[styles.viewBtn, { color: colors.primary }]}>VIEW ›</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Modal
                visible={previewVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setPreviewVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardColor }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.textColor }]}>{currentDoc?.label}</Text>
                            <TouchableOpacity onPress={() => setPreviewVisible(false)}>
                                <Text style={{ color: colors.primary, fontSize: 18, fontWeight: 'bold' }}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.imageContainer}>
                            {currentDoc?.url ? (
                                <Image
                                    source={{ uri: currentDoc.url }}
                                    style={styles.previewImage}
                                    resizeMode="contain"
                                />
                            ) : (
                                <Text style={{ color: colors.subtextColor }}>Loading...</Text>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
};

const DetailRow: React.FC<{ label: string, value: string, color: string, subColor: string, last?: boolean }> = ({ label, value, color, subColor, last }) => (
    <View style={[styles.detailRow, !last && { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }]}>
        <Text style={[styles.detailLabel, { color: subColor }]}>{label}</Text>
        <Text style={[styles.detailValue, { color: color }]}>{value}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        paddingTop: 40,
    },
    backButton: {
        marginRight: 16,
    },
    backText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    content: {
        padding: 20,
    },
    infoCard: {
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: 16,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 16,
    },
    detailLabel: {
        fontSize: 14,
    },
    detailValue: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 1,
        marginLeft: 4,
    },
    docRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 12,
    },
    docInfo: {
        flex: 1,
        marginRight: 10,
    },
    docLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 2,
    },
    docFilename: {
        fontSize: 12,
        opacity: 0.7,
    },
    viewBtn: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    spacer12: { height: 12 },
    spacer24: { height: 24 },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 600,
        height: '80%',
        borderRadius: 24,
        padding: 20,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    imageContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 12,
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
});

export default VehicleDetailsScreen;
