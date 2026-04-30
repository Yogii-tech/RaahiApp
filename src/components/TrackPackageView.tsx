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
    Modal,
    Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiRequest } from '../utils/api';

const { width } = Dimensions.get('window');

interface TrackPackageViewProps {
    isHistoryMode?: boolean;
}

const TrackPackageView: React.FC<TrackPackageViewProps> = ({ isHistoryMode }) => {
    const { colors, isDark } = useTheme();
    const { logout } = useAuth();
    const { t } = useLanguage();
    const [shipments, setShipments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [foundShipment, setFoundShipment] = useState<any>(null);

    const [isRateCalcVisible, setRateCalcVisible] = useState(false);
    const [isHistoryVisible, setHistoryVisible] = useState(false);
    const [isPickupVisible, setPickupVisible] = useState(false);
    const [isDropoffVisible, setDropoffVisible] = useState(false);

    const [ratePickup, setRatePickup] = useState('');
    const [rateDropoff, setRateDropoff] = useState('');
    const [rateWeight, setRateWeight] = useState('');
    const [calculatingRate, setCalculatingRate] = useState(false);
    const [calculatedResult, setCalculatedResult] = useState<string | null>(null);

    const handleCalculateRate = async () => {
        if (!ratePickup || !rateDropoff || !rateWeight) {
            Alert.alert('Error', 'Please fill all fields');
            return;
        }
        setCalculatingRate(true);
        setCalculatedResult(null);

        try {
            const geocode = async (query: string) => {
                let q = query.toLowerCase().includes('uttarakhand') ? query : `${query}, Uttarakhand`;
                let res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`);
                let data = await res.json();
                
                if (!data || data.length === 0) {
                    res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`);
                    data = await res.json();
                }
                
                if (!data || data.length === 0) {
                    const cleanQuery = query.toLowerCase().replace(/(bus stand|bus station|railway station|airport|taxi stand)/g, '').trim();
                    if (cleanQuery && cleanQuery !== query.toLowerCase()) {
                        res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanQuery + ', Uttarakhand')}&format=json&limit=1`);
                        data = await res.json();
                        if (!data || data.length === 0) {
                            res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanQuery)}&format=json&limit=1`);
                            data = await res.json();
                        }
                    }
                }
                return data;
            };

            const pData = await geocode(ratePickup);
            const dData = await geocode(rateDropoff);

            if (pData && pData.length > 0 && dData && dData.length > 0) {
                const url = `https://router.project-osrm.org/route/v1/driving/${pData[0].lon},${pData[0].lat};${dData[0].lon},${dData[0].lat}?overview=false`;
                const rRes = await fetch(url);
                const rData = await rRes.json();
                
                if (rData.routes && rData.routes.length > 0) {
                    let distanceKm = rData.routes[0].distance / 1000;
                    
                    // Apply a regional routing calibration factor (approx 7% reduction).
                    // Open-source routing (OSRM) often prefers wider highways in hills, 
                    // missing local shortcuts that Google Maps utilizes. This brings the
                    // estimate much closer to real-world driven distances in Uttarakhand.
                    distanceKm = distanceKm * 0.933;

                    const weight = parseFloat(rateWeight) || 1;
                    // Formula: 50 Rs base + 10 Rs per km + 20 Rs per kg
                    let rate = 50 + (distanceKm * 10) + (weight * 20);
                    setCalculatedResult(`₹ ${Math.round(rate)} (Distance: ${distanceKm.toFixed(1)} km)`);
                } else {
                    setCalculatedResult('Could not calculate route distance');
                }
            } else {
                setCalculatedResult('Could not find locations');
            }
        } catch (e) {
            console.error(e);
            setCalculatedResult('Error calculating rate');
        } finally {
            setCalculatingRate(false);
        }
    };

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFoundShipment(null);
            return;
        }
        const query = searchQuery.trim().toUpperCase();
        const matched = shipments.find(s => {
            const displayId = `RA-P-${s.id.slice(-6).toUpperCase()}`;
            return displayId === query || s.id.toUpperCase().includes(query) || displayId.includes(query);
        });
        setFoundShipment(matched || null);
    }, [searchQuery, shipments]);

    useEffect(() => {
        fetchShipments();
        const interval = setInterval(() => {
            fetchShipments(true);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchShipments = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const response = await apiRequest(`/api/rides/bookings?t=${Date.now()}`, {}, logout);
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

    const activeShipments = shipments.filter(s => ['picked_up', 'accepted', 'pending'].includes(s.status));
    activeShipments.sort((a, b) => {
        const priority: Record<string, number> = { 'picked_up': 1, 'accepted': 2, 'pending': 3 };
        if (priority[a.status] !== priority[b.status]) {
            return priority[a.status] - priority[b.status];
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    const currentShipment = activeShipments[0];
    const recentShipments = shipments.filter(s => s !== currentShipment);

    return (
        <>
        <ScrollView 
            style={[styles.container, { backgroundColor: colors.background }]} 
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
            }
        >
            {/* Header Section */}
            <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
                <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.textColor, marginBottom: 20 }}>
                    {isHistoryMode ? t('parcel.history') : t('parcel.trackTitle')}
                </Text>
                {!isHistoryMode && (
                    <View style={[styles.searchContainer, { backgroundColor: colors.cardColor, borderWidth: 1, borderColor: colors.borderColor, marginTop: 0 }]}>
                        <Icon name="search-outline" size={20} color={colors.subtextColor} style={styles.searchIcon} />
                        <TextInput
                            style={[styles.searchInput, { color: colors.textColor }]}
                            placeholder={t('parcel.enterTracking') || 'Enter your tracking number'}
                            placeholderTextColor={colors.subtextColor}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery !== '' && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Icon name="close-circle" size={18} color={colors.subtextColor} />
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>

            {!isHistoryMode && (
                <View style={styles.quickActionsContainer}>
                    <View style={[styles.quickActionsCard, { backgroundColor: colors.cardColor, borderColor: colors.borderColor, borderWidth: 1 }]}>
                        <QuickActionItem icon="receipt-outline" label={t('parcel.checkRate')} color="#4CAF50" isDark={isDark} colors={colors} onPress={() => setRateCalcVisible(true)} />
                        <QuickActionItem icon="cube-outline" label={t('parcel.pickUp')} color="#FF9800" isDark={isDark} colors={colors} onPress={() => setPickupVisible(true)} />
                        <QuickActionItem icon="location-outline" label={t('parcel.dropOff')} color="#2196F3" isDark={isDark} colors={colors} onPress={() => setDropoffVisible(true)} />
                    </View>
                </View>
            )}

            {loading && !refreshing ? (
                <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 40 }} />
            ) : (
                <>
                    {/* Search Results */}
                    {foundShipment && (
                        <View style={[styles.section, { marginTop: 10 }]}>
                            <Text style={[styles.sectionTitle, { color: colors.textColor, marginBottom: 15 }]}>Tracking Result</Text>
                            <View style={[styles.shipmentCard, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}>
                                <View style={styles.shipmentTop}>
                                    <View style={[styles.shipmentIconContainer, { backgroundColor: colors.primary + '10' }]}>
                                        <Icon name="cube-outline" size={24} color={colors.primary} />
                                    </View>
                                    <View style={styles.shipmentInfo}>
                                        <Text style={[styles.shipmentId, { color: colors.textColor }]}>
                                            RA-P-{foundShipment.id.slice(-6).toUpperCase()}
                                        </Text>
                                        <Text style={[styles.shipmentStatus, { color: colors.subtextColor }]}>
                                            {foundShipment.status.replace('_', ' ').toUpperCase()} • {new Date(foundShipment.createdAt).toLocaleDateString()}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.stepperContainer}>
                                    <View style={styles.stepperIcons}>
                                        <StepperDot active={true} completed={true} colors={colors} />
                                        <StepperLine active={foundShipment.status === 'picked_up' || foundShipment.status === 'completed'} dashed={foundShipment.status === 'pending' || foundShipment.status === 'accepted'} colors={colors} />
                                        <StepperDot active={foundShipment.status === 'picked_up' || foundShipment.status === 'completed'} completed={foundShipment.status === 'picked_up' || foundShipment.status === 'completed'} colors={colors} />
                                        <StepperLine active={foundShipment.status === 'completed'} dashed={foundShipment.status !== 'completed'} colors={colors} />
                                        <StepperDot active={foundShipment.status === 'completed'} completed={foundShipment.status === 'completed'} colors={colors} />
                                    </View>
                                </View>

                                <View style={styles.pathInfo}>
                                    <View style={{ flex: 1, alignItems: 'flex-start' }}>
                                        <Text style={[styles.pathLabel, { color: colors.primary }]}>{t('parcel.from')}</Text>
                                        <Text style={[styles.pathValue, { color: colors.textColor }]} numberOfLines={1}>{foundShipment.pickup.split(',')[0]}</Text>
                                    </View>
                                    <View style={{ flex: 1, alignItems: 'center' }}>
                                        <Text style={[styles.pathLabel, { color: colors.primary }]}>Picked Up</Text>
                                        <Text style={[styles.pathValue, { color: colors.subtextColor, fontSize: 11 }]} numberOfLines={1}>{foundShipment.status === 'picked_up' ? 'In Transit' : 'Waiting'}</Text>
                                    </View>
                                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                        <Text style={[styles.pathLabel, { color: colors.primary }]}>{t('parcel.to')}</Text>
                                        <Text style={[styles.pathValue, { color: colors.textColor }]} numberOfLines={1}>{(foundShipment.dropLocation || foundShipment.dropoff).split(',')[0]}</Text>
                                    </View>
                                </View>

                                <View style={{ marginTop: 25, borderTopWidth: 1, borderTopColor: colors.borderColor, paddingTop: 20 }}>
                                    <DetailRow label="Pickup" value={foundShipment.pickup} colors={colors} />
                                    <DetailRow label="Dropoff" value={foundShipment.dropLocation || foundShipment.dropoff} colors={colors} />
                                    <DetailRow label="Recipient" value={foundShipment.recipientName || 'N/A'} colors={colors} />
                                    <DetailRow label="Size/Weight" value={foundShipment.parcelSize || 'Standard'} colors={colors} />
                                    <DetailRow label="Price" value={foundShipment.price ? `₹${foundShipment.price}` : 'N/A'} colors={colors} />
                                </View>
                            </View>
                            <View style={{ height: 20 }} />
                        </View>
                    )}

                    {/* Shipments List */}
                    <View style={styles.section}>
                        {!isHistoryMode && (
                            <View style={styles.sectionHeader}>
                                <Text style={[styles.sectionTitle, { color: colors.textColor }]}>{t('parcel.currentShipment')}</Text>
                            </View>
                        )}

                        {!isHistoryMode && currentShipment && (
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
                                            {currentShipment.status === 'pending' ? t('parcel.waitingForDriver') : currentShipment.status === 'accepted' ? 'Driver Accepted (Awaiting Pickup)' : t('parcel.onTheWay')} • {new Date(currentShipment.createdAt).toLocaleDateString()}
                                        </Text>
                                    </View>
                                    <Icon name="chevron-forward" size={20} color={colors.subtextColor} />
                                </View>

                                {/* Progress Bar */}
                                <View style={styles.stepperContainer}>
                                    <View style={styles.stepperIcons}>
                                        <StepperDot active={true} completed={true} colors={colors} />
                                        <StepperLine active={currentShipment.status === 'picked_up' || currentShipment.status === 'completed'} dashed={currentShipment.status === 'pending' || currentShipment.status === 'accepted'} colors={colors} />
                                        <StepperDot active={currentShipment.status === 'picked_up' || currentShipment.status === 'completed'} completed={currentShipment.status === 'picked_up' || currentShipment.status === 'completed'} colors={colors} />
                                        <StepperLine active={currentShipment.status === 'completed'} dashed={currentShipment.status !== 'completed'} colors={colors} />
                                        <StepperDot active={currentShipment.status === 'completed'} completed={currentShipment.status === 'completed'} colors={colors} />
                                    </View>
                                </View>

                                <View style={styles.pathInfo}>
                                    <View style={{ flex: 1, alignItems: 'flex-start' }}>
                                        <Text style={[styles.pathLabel, { color: colors.primary }]}>{t('parcel.from')}</Text>
                                        <Text style={[styles.pathValue, { color: colors.textColor }]} numberOfLines={1}>{currentShipment.pickup.split(',')[0]}</Text>
                                    </View>
                                    <View style={{ flex: 1, alignItems: 'center' }}>
                                        <Text style={[styles.pathLabel, { color: colors.primary }]}>Picked Up</Text>
                                        <Text style={[styles.pathValue, { color: colors.subtextColor, fontSize: 11 }]} numberOfLines={1}>{currentShipment.status === 'picked_up' ? 'In Transit' : 'Waiting'}</Text>
                                    </View>
                                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                        <Text style={[styles.pathLabel, { color: colors.primary }]}>{t('parcel.to')}</Text>
                                        <Text style={[styles.pathValue, { color: colors.textColor }]} numberOfLines={1}>{(currentShipment.dropLocation || currentShipment.dropoff).split(',')[0]}</Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        {!isHistoryMode && !currentShipment && (
                            <View style={[styles.shipmentCard, { backgroundColor: colors.cardColor, borderColor: colors.borderColor, alignItems: 'center', padding: 30 }]}>
                                <Icon name="cube-outline" size={48} color={colors.borderColor} />
                                <Text style={{ color: colors.subtextColor, marginTop: 10 }}>{t('parcel.noActiveShipments')}</Text>
                            </View>
                        )}

                        {/* History List - Only show in dedicated History tab */}
                        {isHistoryMode && (
                            <View style={{ marginTop: 0 }}>
                                {shipments.length > 0 ? (
                                    shipments.map((item) => (
                                        <RecentShipmentItem 
                                            key={item.id}
                                            item={item}
                                            colors={colors} 
                                            primaryColor={colors.primary} 
                                        />
                                    ))
                                ) : (
                                    <Text style={{ color: colors.subtextColor, textAlign: 'center', marginTop: 10 }}>{t('parcel.noRecentHistory')}</Text>
                                )}
                            </View>
                        )}
                    </View>
                </>
            )}

            <View style={{ height: 100 }} />
        </ScrollView>

        <Modal visible={isRateCalcVisible} transparent animationType="slide">
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: colors.textColor }]}>Freight Rate Calculator</Text>
                        <TouchableOpacity onPress={() => setRateCalcVisible(false)}>
                            <Icon name="close" size={24} color={colors.textColor} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.modalBody}>
                        <Text style={[styles.inputLabel, { color: colors.textColor }]}>Pickup Location</Text>
                        <TextInput
                            style={[styles.inputField, { color: colors.textColor, borderColor: colors.borderColor }]}
                            placeholder="e.g. Almora"
                            placeholderTextColor={colors.subtextColor}
                            value={ratePickup}
                            onChangeText={setRatePickup}
                        />

                        <Text style={[styles.inputLabel, { color: colors.textColor }]}>Drop Off Location</Text>
                        <TextInput
                            style={[styles.inputField, { color: colors.textColor, borderColor: colors.borderColor }]}
                            placeholder="e.g. Haldwani"
                            placeholderTextColor={colors.subtextColor}
                            value={rateDropoff}
                            onChangeText={setRateDropoff}
                        />

                        <Text style={[styles.inputLabel, { color: colors.textColor }]}>Weight (kg)</Text>
                        <TextInput
                            style={[styles.inputField, { color: colors.textColor, borderColor: colors.borderColor }]}
                            placeholder="e.g. 5"
                            placeholderTextColor={colors.subtextColor}
                            keyboardType="numeric"
                            value={rateWeight}
                            onChangeText={setRateWeight}
                        />

                        {calculatedResult && (
                            <View style={[styles.resultBox, { backgroundColor: colors.primary + '15' }]}>
                                <Text style={[styles.resultText, { color: colors.primary }]}>{calculatedResult}</Text>
                            </View>
                        )}

                        <TouchableOpacity 
                            style={[styles.calcButton, { backgroundColor: colors.primary }]}
                            onPress={handleCalculateRate}
                            disabled={calculatingRate}
                        >
                            {calculatingRate ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.calcButtonText}>Calculate Rate</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>

        {/* Pickup Modal */}
        <Modal visible={isPickupVisible} transparent animationType="fade">
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: colors.textColor }]}>Pickup Details</Text>
                        <TouchableOpacity onPress={() => setPickupVisible(false)}>
                            <Icon name="close" size={24} color={colors.textColor} />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.modalBody}>
                        {currentShipment ? (
                            <>
                                <Text style={[styles.inputLabel, { color: colors.primary }]}>Pickup Point</Text>
                                <Text style={{ color: colors.textColor, fontSize: 16, marginBottom: 15 }}>{currentShipment.pickup}</Text>
                                <Text style={[styles.inputLabel, { color: colors.primary }]}>Booking ID</Text>
                                <Text style={{ color: colors.textColor, fontSize: 16 }}>RA-P-{currentShipment.id.slice(-6).toUpperCase()}</Text>
                            </>
                        ) : (
                            <Text style={{ color: colors.subtextColor, textAlign: 'center' }}>No active shipment available.</Text>
                        )}
                    </View>
                </View>
            </View>
        </Modal>

        {/* Drop Off Modal */}
        <Modal visible={isDropoffVisible} transparent animationType="fade">
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: colors.textColor }]}>Drop Off Details</Text>
                        <TouchableOpacity onPress={() => setDropoffVisible(false)}>
                            <Icon name="close" size={24} color={colors.textColor} />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.modalBody}>
                        {currentShipment ? (
                            <>
                                <Text style={[styles.inputLabel, { color: colors.primary }]}>Drop Location</Text>
                                <Text style={{ color: colors.textColor, fontSize: 16, marginBottom: 15 }}>{currentShipment.dropLocation || currentShipment.dropoff}</Text>
                                
                                <Text style={[styles.inputLabel, { color: colors.primary }]}>Recipient Name</Text>
                                <Text style={{ color: colors.textColor, fontSize: 16, marginBottom: 15 }}>{currentShipment.recipientName || 'Not Provided'}</Text>
                                
                                <Text style={[styles.inputLabel, { color: colors.primary }]}>Contact Number</Text>
                                <Text style={{ color: colors.textColor, fontSize: 16 }}>{currentShipment.contactNumber || 'Not Provided'}</Text>
                            </>
                        ) : (
                            <Text style={{ color: colors.subtextColor, textAlign: 'center' }}>No active shipment available.</Text>
                        )}
                    </View>
                </View>
            </View>
        </Modal>

        {/* History Modal */}
        <Modal visible={isHistoryVisible} transparent animationType="slide">
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: colors.background, maxHeight: '90%' }]}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: colors.textColor }]}>Parcel History</Text>
                        <TouchableOpacity onPress={() => setHistoryVisible(false)}>
                            <Icon name="close" size={24} color={colors.textColor} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={{ paddingBottom: 20 }}>
                        {shipments.length > 0 ? (
                            shipments.map((item) => (
                                <RecentShipmentItem 
                                    key={item.id}
                                    item={item}
                                    colors={colors} 
                                    primaryColor={colors.primary} 
                                />
                            ))
                        ) : (
                            <Text style={{ color: colors.subtextColor, textAlign: 'center', marginTop: 20 }}>No parcel history found.</Text>
                        )}
                        <View style={{ height: 40 }} />
                    </ScrollView>
                </View>
            </View>
        </Modal>
        </>
    );
};

const QuickActionItem = ({ icon, label, color, isDark, colors, onPress }: { icon: string; label: string; color: string; isDark: boolean; colors: any; onPress?: () => void }) => (
    <TouchableOpacity style={styles.quickActionItem} onPress={onPress}>
        <View style={[styles.quickActionIcon, { backgroundColor: color + '15' }]}>
            <Icon name={icon} size={24} color={color} />
        </View>
        <Text style={[styles.quickActionLabel, { color: colors.textColor }]}>{label}</Text>
    </TouchableOpacity>
);

const DetailRow = ({ label, value, colors }: { label: string; value: string; colors: any }) => (
    <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        <Text style={{ color: colors.textColor, fontWeight: 'bold', width: 90, fontSize: 14 }}>{label}:</Text>
        <Text style={{ color: colors.subtextColor, flex: 1, fontSize: 14 }}>{value}</Text>
    </View>
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

const RecentShipmentItem = ({ item, colors, primaryColor }: { item: any; colors: any; primaryColor: string }) => {
    const [expanded, setExpanded] = useState(false);
    const completed = item.status === 'completed';
    const id = `RA-P-${item.id.slice(-6).toUpperCase()}`;
    const status = `${item.status.toUpperCase().replace('_', ' ')} • ${new Date(item.createdAt).toLocaleDateString()}`;

    return (
        <View style={{ marginBottom: 12 }}>
            <TouchableOpacity 
                style={[styles.recentCard, { backgroundColor: colors.cardColor, borderColor: colors.borderColor, marginBottom: 0, borderBottomLeftRadius: expanded ? 0 : 15, borderBottomRightRadius: expanded ? 0 : 15 }]}
                onPress={() => setExpanded(!expanded)}
            >
                <View style={[styles.shipmentIconContainer, { backgroundColor: completed ? 'rgba(76, 175, 80, 0.05)' : primaryColor + '10' }]}>
                     <Icon name="cube-outline" size={20} color={completed ? '#4CAF50' : primaryColor} />
                </View>
                <View style={styles.shipmentInfo}>
                    <Text style={[styles.shipmentId, { color: colors.textColor }]}>{id}</Text>
                    <Text style={[styles.shipmentStatus, { color: colors.subtextColor }]}>{status}</Text>
                </View>
                <Icon name={expanded ? "chevron-down" : "chevron-forward"} size={18} color={colors.subtextColor} />
            </TouchableOpacity>
            
            {expanded && (
                <View style={{ backgroundColor: colors.cardColor, borderColor: colors.borderColor, borderWidth: 1, borderTopWidth: 0, padding: 15, borderBottomLeftRadius: 15, borderBottomRightRadius: 15 }}>
                    <Text style={{ color: colors.subtextColor, fontSize: 13, marginBottom: 6 }}><Text style={{ fontWeight: 'bold', color: colors.textColor }}>Pickup:</Text> {item.pickup}</Text>
                    <Text style={{ color: colors.subtextColor, fontSize: 13, marginBottom: 6 }}><Text style={{ fontWeight: 'bold', color: colors.textColor }}>Dropoff:</Text> {item.dropLocation || item.dropoff}</Text>
                    <Text style={{ color: colors.subtextColor, fontSize: 13, marginBottom: 6 }}><Text style={{ fontWeight: 'bold', color: colors.textColor }}>Recipient:</Text> {item.recipientName || 'N/A'} ({item.contactNumber || 'N/A'})</Text>
                    <Text style={{ color: colors.subtextColor, fontSize: 13, marginBottom: 6 }}><Text style={{ fontWeight: 'bold', color: colors.textColor }}>Size/Weight:</Text> {item.parcelSize || 'Standard'}</Text>
                    <Text style={{ color: colors.subtextColor, fontSize: 13, marginBottom: 6 }}><Text style={{ fontWeight: 'bold', color: colors.textColor }}>Price:</Text> {item.price ? `₹${item.price}` : 'N/A'}</Text>
                    {completed && item.completedAt && (
                        <Text style={{ color: colors.subtextColor, fontSize: 13, marginBottom: 0 }}><Text style={{ fontWeight: 'bold', color: colors.textColor }}>Delivered:</Text> {new Date(item.completedAt).toLocaleString()}</Text>
                    )}
                </View>
            )}
        </View>
    );
};

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
        outlineStyle: 'none',
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '80%',
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
    modalBody: {
        paddingBottom: 40,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        marginTop: 15,
    },
    inputField: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
    },
    calcButton: {
        borderRadius: 12,
        padding: 15,
        alignItems: 'center',
        marginTop: 25,
    },
    calcButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    resultBox: {
        marginTop: 20,
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    resultText: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
});

export default TrackPackageView;
