import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Modal,
    Image,
    Platform,
    Linking,
    ActivityIndicator,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { notify } from '../utils/notify';

import { API_BASE } from '../apiConfig';

const isPdfUrl = (url: string): boolean => {
    const lower = url.toLowerCase();
    return /\.pdf(\?.*)?(#.*)?$/i.test(lower) || lower.includes('application/pdf');
};

const VehicleDetailsScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { t } = useLanguage();
    const [previewVisible, setPreviewVisible] = useState(false);
    const [currentDoc, setCurrentDoc] = useState<{ label: string, url: string } | null>(null);
    const [imageLoading, setImageLoading] = useState(false);
    const [imageError, setImageError] = useState(false);

    const vehicle = user?.vehicle;

    const handleViewDocument = (label: string, url: string) => {
        if (!url) {
            notify(t('common.error'), 'No document uploaded');
            return;
        }

        // Prepend API_BASE if it's a relative path from the server
        const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
        setImageError(false);
        setImageLoading(!isPdfUrl(fullUrl));
        setCurrentDoc({ label, url: fullUrl });
        setPreviewVisible(true);
    };

    const handleClosePreview = () => {
        setPreviewVisible(false);
        setImageLoading(false);
        setImageError(false);
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

    const isCurrentPdf = currentDoc?.url ? isPdfUrl(currentDoc.url) : false;

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
                onRequestClose={handleClosePreview}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardColor }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.textColor }]}>{currentDoc?.label}</Text>
                            <TouchableOpacity onPress={handleClosePreview}>
                                <Text style={{ color: colors.primary, fontSize: 18, fontWeight: 'bold' }}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.imageContainer}>
                            {currentDoc?.url ? (
                                isCurrentPdf ? (
                                    Platform.OS === 'web' ? (
                                        <View style={{ width: '100%', height: '100%' }}>
                                            {React.createElement('iframe', {
                                                src: currentDoc.url,
                                                title: currentDoc.label,
                                                style: {
                                                    width: '100%',
                                                    height: '100%',
                                                    border: 'none',
                                                    borderRadius: 8,
                                                    flex: 1,
                                                },
                                            })}
                                            <TouchableOpacity
                                                style={[styles.openDocBtn, { backgroundColor: colors.primary }]}
                                                onPress={() => Linking.openURL(currentDoc.url)}>
                                                <Text style={styles.openDocBtnText}>Open PDF in New Tab</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <View style={styles.pdfFallback}>
                                            <Text style={{ fontSize: 42, marginBottom: 12 }}>📄</Text>
                                            <Text style={[styles.pdfTitle, { color: colors.textColor }]}>PDF Document</Text>
                                            <Text style={[styles.pdfFilename, { color: colors.subtextColor }]} numberOfLines={2}>
                                                {currentDoc.url.split('/').pop()}
                                            </Text>
                                            <TouchableOpacity
                                                style={[styles.openDocBtn, { backgroundColor: colors.primary }]}
                                                onPress={() => Linking.openURL(currentDoc.url)}>
                                                <Text style={styles.openDocBtnText}>Open PDF</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )
                                ) : imageError ? (
                                    <View style={styles.pdfFallback}>
                                        <Text style={{ fontSize: 36, marginBottom: 10 }}>⚠️</Text>
                                        <Text style={[styles.pdfTitle, { color: colors.textColor }]}>Unable to load preview</Text>
                                        <TouchableOpacity
                                            style={[styles.openDocBtn, { backgroundColor: colors.primary }]}
                                            onPress={() => Linking.openURL(currentDoc.url)}>
                                            <Text style={styles.openDocBtnText}>Open Document</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <>
                                        {imageLoading && (
                                            <ActivityIndicator
                                                size="large"
                                                color={colors.primary}
                                                style={{ position: 'absolute', zIndex: 1 }}
                                            />
                                        )}
                                        <Image
                                            source={{ uri: currentDoc.url }}
                                            style={styles.previewImage}
                                            resizeMode="contain"
                                            onLoadStart={() => setImageLoading(true)}
                                            onLoadEnd={() => setImageLoading(false)}
                                            onError={() => {
                                                setImageLoading(false);
                                                setImageError(true);
                                            }}
                                        />
                                    </>
                                )
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
        overflow: 'hidden',
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    pdfFallback: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    pdfTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 6,
    },
    pdfFilename: {
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 16,
    },
    openDocBtn: {
        marginTop: 12,
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 10,
        alignItems: 'center',
    },
    openDocBtnText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 14,
    },
});

export default VehicleDetailsScreen;
