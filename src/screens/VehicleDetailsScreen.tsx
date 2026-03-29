import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const VehicleDetailsScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { t } = useLanguage();

    const vehicle = user?.vehicle;

    const handleViewDocument = (label: string, filename: string) => {
        if (!filename) {
            Alert.alert(t('common.error'), 'No document uploaded');
            return;
        }
        Alert.alert(label, `Viewing document: ${filename}\n\n(In a production app, this would open the file viewer or download the document)`);
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
        { label: t('login.uploadDL'), key: 'dl_url', filename: vehicle.dl_url },
        { label: t('login.uploadRC'), key: 'rc_url', filename: vehicle.rc_url },
        { label: t('login.uploadPollution'), key: 'pollution_url', filename: vehicle.pollution_url },
        { label: t('login.uploadVehicleImg'), key: 'vehicle_image_url', filename: vehicle.vehicle_image_url },
        { label: t('login.uploadOwnership'), key: 'ownership_url', filename: vehicle.ownership_url },
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
                        onPress={() => handleViewDocument(doc.label, doc.filename)}
                    >
                        <View style={styles.docInfo}>
                            <Text style={[styles.docLabel, { color: colors.textColor }]}>{doc.label}</Text>
                            <Text style={[styles.docFilename, { color: colors.subtextColor }]} numberOfLines={1}>
                                {doc.filename || 'Not uploaded'}
                            </Text>
                        </View>
                        <Text style={[styles.viewBtn, { color: colors.primary }]}>VIEW ›</Text>
                    </TouchableOpacity>
                ))}
            </View>
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
});

export default VehicleDetailsScreen;
