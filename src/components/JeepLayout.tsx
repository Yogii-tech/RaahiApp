import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

interface JeepLayoutProps {
    selectedSeats?: number[];
    takenSeats?: number[];
    onSeatPress?: (index: number) => void;
    interactive?: boolean;
    numSeatsRequested?: number;
}

const JeepLayout: React.FC<JeepLayoutProps> = ({
    selectedSeats = [],
    takenSeats = [],
    onSeatPress,
    interactive = true,
    numSeatsRequested = 1,
}) => {
    const { colors, isDark } = useTheme();
    const { t } = useLanguage();

    const getSeatColor = (index: number) => {
        if (takenSeats.includes(index)) return '#FF5252'; // TAKEN
        if (selectedSeats.includes(index)) return colors.primary; // PICK
        return colors.background; // FREE
    };

    const handlePress = (index: number) => {
        if (!interactive || takenSeats.includes(index)) return;
        if (onSeatPress) onSeatPress(index);
    };

    const renderSeat = (index: number) => (
        <TouchableOpacity
            key={index}
            style={[
                styles.seatBox,
                {
                    backgroundColor: getSeatColor(index),
                    borderColor: colors.borderColor,
                },
            ]}
            onPress={() => handlePress(index)}
            disabled={!interactive || takenSeats.includes(index)}>
            <Text style={styles.seatIcon}>👤</Text>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.layoutCard, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}>
            <View style={styles.layoutHeader}>
                <Text style={[styles.layoutTitle, { color: colors.textColor }]}>{t('jeep.title')}</Text>
                {interactive && (
                    <Text style={[styles.layoutStatus, { color: colors.primary }]}>
                        {selectedSeats.length}/{numSeatsRequested} {t('jeep.selected').toUpperCase()}
                    </Text>
                )}
            </View>
            <Text style={[styles.layoutSubtitle, { color: colors.subtextColor }]}>
                {interactive ? t('jeep.tapToReserve') : t('jeep.status')}
            </Text>

            <View style={styles.seatContainer}>
                {/* Front Row (Driver + 1 or 2) */}
                <View style={styles.seatRow}>
                    <View style={[styles.seatBox, { backgroundColor: '#37474F' }]}>
                        <Text style={styles.seatIcon}>🛞</Text>
                    </View>
                    {renderSeat(1)}
                    {renderSeat(2)}
                </View>

                {/* Middle Row */}
                <View style={styles.seatRow}>
                    {[3, 4, 5].map(renderSeat)}
                </View>

                {/* Middle Back Row */}
                <View style={styles.seatRow}>
                    {[6, 7, 8].map(renderSeat)}
                </View>

                {/* Rear Row */}
                <View style={styles.seatRow}>
                    <View style={styles.seatPlaceholder} />
                    {renderSeat(9)}
                    <View style={styles.seatPlaceholder} />
                </View>
            </View>

            <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                    <View style={[styles.dot, { backgroundColor: colors.borderColor }]} />
                    <Text style={[styles.legendText, { color: colors.subtextColor }]}>{t('jeep.free')}</Text>
                </View>
                {interactive && (
                    <View style={styles.legendItem}>
                        <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                        <Text style={[styles.legendText, { color: colors.subtextColor }]}>{t('jeep.pick')}</Text>
                    </View>
                )}
                <View style={styles.legendItem}>
                    <View style={[styles.dot, { backgroundColor: '#FF5252' }]} />
                    <Text style={[styles.legendText, { color: colors.subtextColor }]}>{t('jeep.taken')}</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    layoutCard: {
        borderRadius: 24,
        borderWidth: 1,
        padding: 24,
        marginBottom: 20,
    },
    layoutHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    layoutTitle: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    layoutStatus: {
        fontSize: 12,
        fontWeight: 'bold',
        backgroundColor: 'rgba(91, 79, 255, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    layoutSubtitle: {
        fontSize: 10,
        marginBottom: 25,
    },
    seatContainer: {
        alignItems: 'center',
        marginBottom: 30,
    },
    seatRow: {
        flexDirection: 'row',
        marginBottom: 15,
        gap: 15,
    },
    seatBox: {
        width: 50,
        height: 50,
        borderRadius: 12,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    seatPlaceholder: {
        width: 50,
    },
    seatIcon: {
        fontSize: 20,
    },
    legendRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 15,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    legendText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
});

export default JeepLayout;
