import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

const TrackPackageView: React.FC = () => {
    const { colors, isDark } = useTheme();

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
            {/* Header Section */}
            <View style={[styles.header, { backgroundColor: colors.primary }]}>
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>Let's Track Your Package</Text>
                    <View style={[styles.searchContainer, { backgroundColor: colors.cardColor }]}>
                        <Icon name="search-outline" size={20} color={colors.subtextColor} style={styles.searchIcon} />
                        <TextInput
                            style={[styles.searchInput, { color: colors.textColor }]}
                            placeholder="Enter your tracking number"
                            placeholderTextColor={colors.subtextColor}
                        />
                    </View>
                </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.quickActionsContainer}>
                <View style={[styles.quickActionsCard, { backgroundColor: colors.cardColor, borderColor: colors.borderColor, borderWidth: 1 }]}>
                    <QuickActionItem icon="receipt-outline" label="Check Rate" color="#4CAF50" isDark={isDark} colors={colors} />
                    <QuickActionItem icon="cube-outline" label="Pick Up" color="#FF9800" isDark={isDark} colors={colors} />
                    <QuickActionItem icon="location-outline" label="Drop Off" color="#2196F3" isDark={isDark} colors={colors} />
                    <QuickActionItem icon="time-outline" label="History" color="#9C27B0" isDark={isDark} colors={colors} />
                </View>
            </View>

            {/* Current Shipment */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.textColor }]}>Current Shipment</Text>
                    <TouchableOpacity>
                        <Text style={{ color: colors.primary, fontWeight: '500' }}>View All</Text>
                    </TouchableOpacity>
                </View>

                <View style={[styles.shipmentCard, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}>
                    <View style={styles.shipmentTop}>
                        <View style={[styles.shipmentIconContainer, { backgroundColor: colors.primary + '10' }]}>
                            <Icon name="cube-outline" size={24} color={colors.primary} />
                        </View>
                        <View style={styles.shipmentInfo}>
                            <Text style={[styles.shipmentId, { color: colors.textColor }]}>#HWDSF776567DS</Text>
                            <Text style={[styles.shipmentStatus, { color: colors.subtextColor }]}>On the way • 24 June</Text>
                        </View>
                        <Icon name="chevron-forward" size={20} color={colors.subtextColor} />
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.stepperContainer}>
                        <View style={styles.stepperIcons}>
                            <StepperDot active={true} completed={true} colors={colors} />
                            <StepperLine active={true} colors={colors} />
                            <StepperDot active={true} completed={true} colors={colors} />
                            <StepperLine active={true} colors={colors} />
                            <StepperDot active={true} completed={true} colors={colors} />
                            <StepperLine active={false} dashed={true} colors={colors} />
                            <StepperDot active={true} completed={false} colors={colors} />
                            <StepperLine active={false} colors={colors} />
                            <StepperDot active={false} completed={false} colors={colors} />
                        </View>
                    </View>

                    <View style={styles.pathInfo}>
                        <View>
                            <Text style={[styles.pathLabel, { color: colors.primary }]}>From</Text>
                            <Text style={[styles.pathValue, { color: colors.textColor }]}>Delhi, India</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.pathLabel, { color: colors.primary }]}>To</Text>
                            <Text style={[styles.pathValue, { color: colors.textColor }]}>California, US</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Recent Shipment */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.textColor }]}>Recent Shipment</Text>
                    <TouchableOpacity>
                        <Text style={{ color: colors.primary, fontWeight: '500' }}>View All</Text>
                    </TouchableOpacity>
                </View>

                <RecentShipmentItem id="#HWDSF776567DS" status="On the way • 24 June" colors={colors} primaryColor={colors.primary} />
                <RecentShipmentItem id="#7XZ6V87Z6XCSA7" status="Delivered • 24 May" colors={colors} completed={true} primaryColor={colors.primary} />
            </View>

            <View style={{ height: 100 }} />
        </ScrollView>
    );
};

const QuickActionItem = ({ icon, label, color, isDark, colors }: { icon: string; label: string; color: string; isDark: boolean; colors: any }) => (
    <TouchableOpacity style={styles.quickActionItem}>
        <View style={[styles.quickActionIcon, { backgroundColor: color + '15' }]}>
            <Icon name={icon} size={24} color={color} />
        </View>
        <Text style={[styles.quickActionLabel, { color: colors.textColor }]}>{label}</Text>
    </TouchableOpacity>
);

const StepperDot = ({ active, completed, colors }: { active: boolean; completed: boolean; colors: any }) => (
    <View style={[
        styles.stepperDot,
        { borderColor: colors.borderColor },
        active && { borderColor: colors.primary },
        completed && { backgroundColor: colors.primary, borderColor: colors.primary, width: 18, height: 18, borderRadius: 9 },
    ]}>
        {completed && <Icon name="checkmark" size={10} color="#FFF" />}
    </View>
);

const StepperLine = ({ active, dashed, colors }: { active: boolean; dashed?: boolean; colors: any }) => (
    <View style={[
        styles.stepperLine,
        { backgroundColor: colors.borderColor },
        active && { backgroundColor: colors.primary },
        dashed && { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed' }
    ]} />
);

const RecentShipmentItem = ({ id, status, colors, completed, primaryColor }: { id: string; status: string; colors: any; completed?: boolean; primaryColor: string }) => (
    <TouchableOpacity style={[styles.recentCard, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}>
        <View style={[styles.shipmentIconContainer, { backgroundColor: completed ? 'rgba(76, 175, 80, 0.05)' : primaryColor + '10' }]}>
             <Icon name="cube-outline" size={20} color={completed ? '#4CAF50' : primaryColor} />
        </View>
        <View style={styles.shipmentInfo}>
            <Text style={[styles.shipmentId, { color: colors.textColor }]}>{id}</Text>
            <Text style={[styles.shipmentStatus, { color: colors.subtextColor }]}>{status}</Text>
        </View>
        <Icon name="chevron-forward" size={18} color={colors.subtextColor} />
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingTop: 20,
        paddingHorizontal: 20,
        paddingBottom: 40,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    headerContent: {
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: 'bold',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 12,
        marginTop: 20,
        paddingHorizontal: 15,
        height: 50,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        color: '#333',
        fontSize: 14,
    },
    quickActionsContainer: {
        marginTop: -30,
        paddingHorizontal: 20,
    },
    quickActionsCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 20,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    quickActionItem: {
        alignItems: 'center',
        flex: 1,
    },
    quickActionIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    quickActionLabel: {
        fontSize: 11,
        fontWeight: '600',
    },
    section: {
        marginTop: 30,
        paddingHorizontal: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    shipmentCard: {
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
    },
    shipmentTop: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    shipmentIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(20, 151, 166, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    shipmentInfo: {
        flex: 1,
        marginLeft: 15,
    },
    shipmentId: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    shipmentStatus: {
        fontSize: 12,
        marginTop: 2,
    },
    stepperContainer: {
        marginTop: 25,
        marginBottom: 20,
        alignItems: 'center',
    },
    stepperIcons: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        justifyContent: 'center',
    },
    stepperDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#EEE',
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepperDotActive: {
        borderColor: '#1497A6',
    },
    stepperDotCompleted: {
        backgroundColor: '#1497A6',
        borderColor: '#1497A6',
        width: 18,
        height: 18,
        borderRadius: 9,
    },
    stepperLine: {
        flex: 1,
        height: 2,
        backgroundColor: '#EEE',
        marginHorizontal: 0,
    },
    stepperLineActive: {
        backgroundColor: '#1497A6',
    },
    stepperLineDashed: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#1497A6',
        borderStyle: 'dashed',
    },
    pathInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    pathLabel: {
        fontSize: 10,
        color: '#1497A6',
        fontWeight: 'bold',
        marginBottom: 4,
    },
    pathValue: {
        fontSize: 13,
        fontWeight: '600',
    },
    recentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderRadius: 15,
        borderWidth: 1,
        marginBottom: 12,
    },
});

export default TrackPackageView;
