import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';

interface TrackPackageViewProps {
    historyOnly?: boolean;
}

const TrackPackageView: React.FC<TrackPackageViewProps> = ({ historyOnly }) => {
    const { colors, isDark } = useTheme();
    const { logout } = useAuth();
    const [shipments, setShipments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchShipments();
    }, []);

    const fetchShipments = async () => {
        try {
            const response = await apiRequest('/api/rides/bookings', {}, logout);
            if (response.ok) {
                const data = await response.json();
                // Filter for parcel types
                const parcels = (data || []).filter((item: any) => item.type === 'parcel');
                setShipments(parcels);
            }
        } catch (err) {
            console.error('Fetch shipments error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchShipments();
    };

    const currentShipment = shipments.find(s => s.status === 'accepted' || s.status === 'pending');
    const recentShipments = shipments.filter(s => s !== currentShipment);

    return (
        <ScrollView 
            style={[styles.container, { backgroundColor: colors.background }]} 
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
            }
        >
            {!historyOnly && (
                <>
                    {/* Search Section */}
                    <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
                        <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.textColor, marginBottom: 20 }}>
                            Let's Track Your Package
                        </Text>
                        <View style={[styles.searchContainer, { backgroundColor: colors.cardColor, borderWidth: 1, borderColor: colors.borderColor, marginTop: 0 }]}>
                            <Icon name="search-outline" size={20} color={colors.subtextColor} style={styles.searchIcon} />
                            <TextInput
                                style={[styles.searchInput, { color: colors.textColor }]}
                                placeholder="Enter your tracking number"
                                placeholderTextColor={colors.subtextColor}
                            />
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
                </>
            )}

            {loading && !refreshing ? (
                <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 40 }} />
            ) : historyOnly ? (
                <View style={[styles.section, { marginTop: 20 }]}>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: colors.textColor }]}>Recent Shipment</Text>
                    </View>

                    {shipments.length > 0 ? (
                        shipments.map((item) => (
                            <RecentShipmentItem 
                                key={item.id}
                                id={`RA-P-${item.id.slice(-6).toUpperCase()}`} 
                                status={`${item.status.toUpperCase()} • ${new Date(item.createdAt).toLocaleDateString()}`} 
                                colors={colors} 
                                completed={item.status === 'completed'}
                                primaryColor={colors.primary} 
                            />
                        ))
                    ) : (
                        <Text style={{ color: colors.subtextColor, textAlign: 'center', marginTop: 10 }}>No recent history</Text>
                    )}
                </View>
            ) : (
                <>
                    {/* Current Shipment */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: colors.textColor }]}>Current Shipment</Text>
                            <TouchableOpacity>
                                <Text style={{ color: colors.primary, fontWeight: '500' }}>View All</Text>
                            </TouchableOpacity>
                        </View>

                        {currentShipment ? (
                            <View style={[styles.shipmentCard, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}>
                                <View style={styles.shipmentTop}>
                                    <View style={[styles.shipmentIconContainer, { backgroundColor: colors.primary + '10' }]}>
                                        <Icon name="cube-outline" size={24} color={colors.primary} />
                                    </View>
                                    <View style={styles.shipmentInfo}>
                                        <Text style={[styles.shipmentId, { color: colors.textColor }]}>
                                            RA-P-{currentShipment.id.slice(-6).toUpperCase()}
                                        </Text>
                                        <Text style={[styles.shipmentStatus, { color: colors.subtextColor }]}>
                                            {currentShipment.status === 'pending' ? 'Waiting for Driver' : 'On the way'} • {new Date(currentShipment.createdAt).toLocaleDateString()}
                                        </Text>
                                    </View>
                                    <Icon name="chevron-forward" size={20} color={colors.subtextColor} />
                                </View>

                                {/* Progress Bar */}
                                <View style={styles.stepperContainer}>
                                    <View style={styles.stepperIcons}>
                                        <StepperDot active={true} completed={true} colors={colors} />
                                        <StepperLine active={true} colors={colors} />
                                        <StepperDot active={currentShipment.status === 'accepted'} completed={currentShipment.status === 'accepted'} colors={colors} />
                                        <StepperLine active={false} dashed={currentShipment.status === 'pending'} colors={colors} />
                                        <StepperDot active={false} completed={false} colors={colors} />
                                        <StepperLine active={false} dashed={true} colors={colors} />
                                        <StepperDot active={false} completed={false} colors={colors} />
                                    </View>
                                </View>

                                <View style={styles.pathInfo}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.pathLabel, { color: colors.primary }]}>From</Text>
                                        <Text style={[styles.pathValue, { color: colors.textColor }]} numberOfLines={1}>{currentShipment.pickup}</Text>
                                    </View>
                                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                        <Text style={[styles.pathLabel, { color: colors.primary }]}>To</Text>
                                        <Text style={[styles.pathValue, { color: colors.textColor }]} numberOfLines={1}>{currentShipment.dropoff}</Text>
                                    </View>
                                </View>
                            </View>
                        ) : (
                            <View style={[styles.shipmentCard, { backgroundColor: colors.cardColor, borderColor: colors.borderColor, alignItems: 'center', padding: 30 }]}>
                                <Icon name="cube-outline" size={48} color={colors.borderColor} />
                                <Text style={{ color: colors.subtextColor, marginTop: 10 }}>No active shipments</Text>
                            </View>
                        )}
                    </View>
                </>
            )}

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
        fontSize: 14,
        borderWidth: 0,
        outlineWidth: 0,
    },
    quickActionsContainer: {
        marginTop: 15,
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
