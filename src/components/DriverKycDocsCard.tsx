import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
    DRIVER_DOC_SLOTS,
    DriverDocFormKey,
    MIN_REQUIRED_DRIVER_DOCS,
    TOTAL_DRIVER_DOC_SLOTS,
    countDistinctDriverDocs,
    extractDriverDocUrls,
    getDriverDocProgressLabel,
    hasMinimumDriverDocs,
} from '../utils/driverDocuments';

const SLOT_ICONS: Record<DriverDocFormKey, string> = {
    dl: '🪪',
    rc: '📄',
    pollution: '🌿',
    image: '📷',
    ownership: '📝',
};

export interface DriverKycDocsCardProps {
    vehicleDocs: Partial<Record<DriverDocFormKey, string | null | undefined>>;
    onUpload: (docKey: DriverDocFormKey) => void;
    loading?: boolean;
    isDark: boolean;
    primaryColor: string;
    textColor: string;
    introText?: string;
}

export const DriverKycDocsCard: React.FC<DriverKycDocsCardProps> = ({
    vehicleDocs,
    onUpload,
    loading = false,
    isDark,
    primaryColor,
    textColor,
    introText,
}) => {
    const distinctCount = countDistinctDriverDocs(vehicleDocs);
    const rawCount = extractDriverDocUrls(vehicleDocs).length;
    const minReached = hasMinimumDriverDocs(vehicleDocs);
    const hasDuplicateUrl = rawCount > distinctCount;
    const progressText = getDriverDocProgressLabel(vehicleDocs);

    return (
        <View style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardIcon}>📋</Text>
                <Text style={[styles.cardTitle, { color: textColor, flex: 1 }]}>
                    Vehicle Documents (Min {MIN_REQUIRED_DRIVER_DOCS} of {TOTAL_DRIVER_DOC_SLOTS})
                </Text>
                <View
                    testID="driver-docs-count-pill"
                    style={[
                        styles.progressPill,
                        minReached ? styles.progressPillReady : styles.progressPillPending,
                    ]}
                >
                    <Text
                        style={[
                            styles.progressPillText,
                            { color: minReached ? '#22C55E' : '#F59E0B' },
                        ]}
                    >
                        {distinctCount}/{TOTAL_DRIVER_DOC_SLOTS}
                    </Text>
                </View>
            </View>

            <Text style={[styles.introText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                {introText ? `${introText} ` : ''}Upload at least {MIN_REQUIRED_DRIVER_DOCS} distinct documents to submit (all 4 core documents recommended). Accepted: JPG, PNG, PDF
            </Text>

            <Text
                testID="driver-docs-progress"
                style={[
                    styles.progressText,
                    { color: minReached ? '#22C55E' : '#F59E0B' },
                ]}
            >
                {progressText}
            </Text>

            {hasDuplicateUrl && (
                <Text testID="driver-docs-duplicate-warning" style={styles.duplicateWarning}>
                    ⚠ Duplicate file URL detected — each required slot needs a separate document file.
                </Text>
            )}

            {DRIVER_DOC_SLOTS.map((slot) => {
                const isUploaded = Boolean(vehicleDocs[slot.formKey]?.trim());
                const badgeText = slot.recommended && !minReached ? 'RECOMMENDED' : 'OPTIONAL';

                return (
                    <TouchableOpacity
                        key={slot.formKey}
                        testID={`driver-doc-row-${slot.formKey}`}
                        style={[
                            styles.docRow,
                            {
                                backgroundColor: isUploaded
                                    ? (isDark ? 'rgba(34,197,94,0.1)' : '#F0FDF4')
                                    : (isDark ? '#0F172A' : '#F8FAFC'),
                                borderColor: isUploaded
                                    ? '#22C55E'
                                    : (isDark ? '#334155' : '#E2E8F0'),
                            },
                            loading && { opacity: 0.6 },
                        ]}
                        onPress={() => onUpload(slot.formKey)}
                        disabled={loading}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.docIconBox, { backgroundColor: isUploaded ? '#22C55E' : `${primaryColor}20` }]}>
                            <Text style={{ fontSize: 20 }}>{isUploaded ? '✅' : SLOT_ICONS[slot.formKey]}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <Text style={[styles.docLabel, { color: textColor }]}>{slot.label}</Text>
                                {!isUploaded && (
                                    <View
                                        style={[
                                            styles.slotBadge,
                                            slot.recommended && !minReached ? styles.recommendedBadge : styles.optionalBadge,
                                        ]}
                                    >
                                        <Text
                                            style={{
                                                color: slot.recommended && !minReached ? '#F59E0B' : '#94A3B8',
                                                fontSize: 9,
                                                fontWeight: '700',
                                            }}
                                        >
                                            {badgeText}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <Text style={[styles.docSub, { color: isDark ? '#64748B' : '#94A3B8' }]}>
                                {isUploaded ? '✓ Uploaded successfully' : slot.sub}
                            </Text>
                        </View>
                        <View
                            style={[
                                styles.uploadChip,
                                { backgroundColor: isUploaded ? '#22C55E' : primaryColor },
                            ]}
                        >
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                                {isUploaded ? 'Change' : 'Upload'}
                            </Text>
                        </View>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        padding: 18,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
    },
    cardIcon: {
        fontSize: 18,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    progressPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        borderWidth: 1,
    },
    progressPillReady: {
        backgroundColor: 'rgba(34,197,94,0.12)',
        borderColor: 'rgba(34,197,94,0.35)',
    },
    progressPillPending: {
        backgroundColor: 'rgba(245,158,11,0.12)',
        borderColor: 'rgba(245,158,11,0.35)',
    },
    progressPillText: {
        fontSize: 11,
        fontWeight: '700',
    },
    introText: {
        fontSize: 12,
        marginBottom: 6,
        lineHeight: 17,
    },
    progressText: {
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 12,
    },
    duplicateWarning: {
        fontSize: 11,
        fontWeight: '600',
        color: '#F59E0B',
        marginBottom: 10,
    },
    docRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1.5,
        padding: 14,
        marginBottom: 10,
        gap: 12,
    },
    docIconBox: {
        width: 44,
        height: 44,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    docLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 2,
    },
    docSub: {
        fontSize: 11,
        lineHeight: 15,
    },
    slotBadge: {
        borderRadius: 4,
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderWidth: 1,
    },
    recommendedBadge: {
        backgroundColor: 'rgba(245,158,11,0.1)',
        borderColor: 'rgba(245,158,11,0.3)',
    },
    optionalBadge: {
        backgroundColor: 'rgba(148,163,184,0.1)',
        borderColor: 'rgba(148,163,184,0.3)',
    },
    uploadChip: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 62,
    },
});
