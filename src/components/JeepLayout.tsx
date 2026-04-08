import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

interface JeepLayoutProps {
    selectedSeats?: number[];
    takenSeats?: number[];
    pendingSeats?: number[];
    onSeatPress?: (index: number) => void;
    interactive?: boolean;
    numSeatsRequested?: number;
    totalSeats?: number;
    layoutType?: string;
    date?: string;
    departureTime?: string;
}

const JeepLayout: React.FC<JeepLayoutProps> = ({
    selectedSeats = [],
    takenSeats = [],
    pendingSeats = [],
    onSeatPress,
    interactive = true,
    numSeatsRequested = 1,
    totalSeats = 9,
    layoutType: propLayoutType,
    date,
    departureTime,
}) => {
    const { colors, isDark } = useTheme();
    const { t } = useLanguage();

    // Smart Inferred Layout
    const layoutType = React.useMemo(() => {
        if (propLayoutType && propLayoutType !== 'suv') return propLayoutType;
        if (totalSeats > 12) return 'bus_2x2';
        if (totalSeats <= 4) return 'sedan';
        return 'suv';
    }, [propLayoutType, totalSeats]);

    const getSeatColor = (index: number) => {
        if (takenSeats.includes(index)) return '#FF5252';   // TAKEN — red
        if (pendingSeats.includes(index)) return '#F59E0B'; // PENDING — yellow
        if (selectedSeats.includes(index)) return colors.primary; // SELECTED — primary
        return colors.background; // FREE
    };

    const handlePress = (index: number) => {
        if (!interactive || takenSeats.includes(index)) return;
        if (onSeatPress) onSeatPress(index);
    };

    const renderSeat = (index: number) => (
        <TouchableOpacity
            key={`seat-${index}`}
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

    const renderDriver = () => (
        <View key="driver" style={[styles.seatBox, { backgroundColor: '#37474F' }]}>
            <Text style={styles.seatIcon}>🛞</Text>
        </View>
    );

    const renderAisle = (id: string, isBus: boolean = false) => (
        <View key={`aisle-${id}`} style={isBus ? styles.busAisle : styles.seatPlaceholder} />
    );

    const renderRows = () => {
        const rows = [];
        let currentSeat = 1;

        if (layoutType === 'sedan') {
            // Row 0: Seat 1 | Aisle | Driver
            rows.push(
                <View key="row0" style={styles.seatRow}>
                    {renderSeat(1)}
                    {renderAisle('front')}
                    {renderDriver()}
                </View>
            );
            currentSeat = 2;
            // Row 1: Seat 2 | Seat 3 | Seat 4
            const row1 = [];
            for (let i = 0; i < 3 && currentSeat <= totalSeats; i++) {
                row1.push(renderSeat(currentSeat++));
            }
            if (row1.length > 0) rows.push(<View key="row1" style={styles.seatRow}>{row1}</View>);
        }
        else if (layoutType === 'bus_2x2') {
            const leftCount = 2;
            const rightCount = 2;
            const rowWidth = 5; // 2 + Aisle + 2

            // Front row: Aisle... | Driver
            const frontRow = [];
            for (let i = 0; i < 4; i++) frontRow.push(renderAisle(`f-${i}`));
            frontRow.push(renderDriver());
            rows.push(<View key="row0" style={styles.seatRow}>{frontRow}</View>);

            // Passenger rows
            let rowIdx = 1;
            while (currentSeat <= totalSeats) {
                const remaining = totalSeats - currentSeat + 1;
                const rowItems = [];

                // Check if this is the BACK BENCH (Indian Style: 5 seats across, no aisle)
                if (remaining <= rowWidth && remaining > 0) {
                    for (let i = 0; i < rowWidth && currentSeat <= totalSeats; i++) {
                        rowItems.push(renderSeat(currentSeat++));
                    }
                    rows.push(<View key={`row${rowIdx}`} style={styles.seatRow}>{rowItems}</View>);
                    break;
                }

                // Normal 2+2 row with Aisle
                // Left side
                for (let i = 0; i < leftCount && currentSeat <= totalSeats; i++) rowItems.push(renderSeat(currentSeat++));
                while (rowItems.length < leftCount) rowItems.push(renderAisle(`l-pad-${rowItems.length}`));

                // Aisle
                rowItems.push(renderAisle(`aisle-${rowIdx}`, true));

                // Right side
                for (let i = 0; i < rightCount && currentSeat <= totalSeats; i++) rowItems.push(renderSeat(currentSeat++));

                rows.push(<View key={`row${rowIdx}`} style={styles.seatRow}>{rowItems}</View>);
                rowIdx++;
            }
        }
        else {
            // Default SUV / Jeep layout
            // Front Row: Seat1 (and 2 if 7+ seats) | Driver
            const frontSeatsCount = totalSeats > 4 ? 2 : 1;
            const frontRow = [];
            for (let i = frontSeatsCount; i >= 1; i--) frontRow.push(renderSeat(i));
            frontRow.push(renderDriver());
            rows.push(<View key="row0" style={styles.seatRow}>{frontRow}</View>);

            currentSeat = frontSeatsCount + 1;
            let rowIdx = 1;
            while (currentSeat <= totalSeats) {
                const seatsInRow = [];
                for (let i = 0; i < 3 && currentSeat <= totalSeats; i++) {
                    seatsInRow.push(renderSeat(currentSeat++));
                }
                if (seatsInRow.length === 1) {
                    rows.push(
                        <View key={`row${rowIdx}`} style={styles.seatRow}>
                            {renderAisle(`p1-${rowIdx}`)}
                            {seatsInRow}
                            {renderAisle(`p2-${rowIdx}`)}
                        </View>
                    );
                } else {
                    rows.push(<View key={`row${rowIdx}`} style={styles.seatRow}>{seatsInRow}</View>);
                }
                rowIdx++;
            }
        }

        return rows;
    };

    const getLayoutTitle = () => {
        if (layoutType === 'sedan') return t('layout.sedan').toUpperCase();
        if (layoutType === 'bus_2x2') return t('layout.bus_2x2').toUpperCase();
        if (layoutType === 'suv' && totalSeats > 6) return t('layout.suv').toUpperCase();
        return t('jeep.title');
    };

    return (
        <View style={[styles.layoutCard, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}>
            <View style={styles.layoutHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.layoutTitle, { color: colors.textColor }]}>
                        {getLayoutTitle()}
                    </Text>
                    {date && departureTime && (
                        <Text style={{ fontSize: 12, color: colors.subtextColor, marginLeft: 8, fontWeight: '500' }}>
                            • 🕒 {departureTime}  📅 {date}
                        </Text>
                    )}
                </View>
                {interactive && (
                    <Text style={[styles.layoutStatus, { color: colors.primary }]}>
                        {selectedSeats.length} {t('jeep.selected').toUpperCase()}
                    </Text>
                )}
            </View>
            <Text style={[styles.layoutSubtitle, { color: colors.subtextColor }]}>
                {interactive ? t('jeep.tapToReserve') : t('jeep.status')}
            </Text>

            <View style={styles.seatContainer}>
                {renderRows()}
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
                {pendingSeats.length > 0 && (
                    <View style={styles.legendItem}>
                        <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
                        <Text style={[styles.legendText, { color: colors.subtextColor }]}>PENDING</Text>
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
    busAisle: {
        width: 30, // Narrower but distinct aisle
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
