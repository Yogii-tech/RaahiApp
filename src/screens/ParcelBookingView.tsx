import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Dimensions,
    Alert,
    Platform,
    Image,
    ActivityIndicator,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { API_BASE } from '../apiConfig';

const { width } = Dimensions.get('window');

interface ParcelBookingViewProps {
    onBack?: () => void;
}

const ParcelBookingView: React.FC<ParcelBookingViewProps> = ({ onBack }) => {
    const { colors, isDark } = useTheme();
    const { t } = useLanguage();
    const { token } = useAuth();
    
    // Step state
    const [step, setStep] = useState<'search' | 'details'>('search');
    const [loading, setLoading] = useState(false);

    // Form state - Step 1
    const [pickup, setPickup] = useState('');
    const [dropoff, setDropoff] = useState('');
    const [selectedSize, setSelectedSize] = useState<'small' | 'medium' | 'large'>('medium');

    // Form state - Step 2 (Recipient Details)
    const [recipientName, setRecipientName] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    const [dropLocation, setDropLocation] = useState('');
    const [notes, setNotes] = useState('');
    const [parcelPhoto, setParcelPhoto] = useState<string | null>(null);

    const sizes = [
        { id: 'small', label: 'parcel.sizeSmall', desc: 'parcel.sizeSmallDesc', icon: 'mail-open-outline' }, // Mailbox-like
        { id: 'medium', label: 'parcel.sizeMedium', desc: 'parcel.sizeMediumDesc', icon: 'cube-outline' }, // Box
        { id: 'large', label: 'parcel.sizeLarge', desc: 'parcel.sizeLargeDesc', icon: 'archive-outline' }, // Cabinet/Archive
    ];

    const popularRoutes = [
        { from: 'Rishikesh', to: 'Tehri', price: '320' },
        { from: 'Dehradun', to: 'Mussoorie', price: '180' },
        { from: 'Bageshwar', to: 'Haldwani', price: '450' },
    ];

    const pickupLabelColor = isDark ? '#00FFFF' : '#5B4FFF';
    const dropoffLabelColor = isDark ? '#FF4081' : '#5B4FFF';

    const handlePhotoUpload = () => {
        if (Platform.OS === 'web') {
            // @ts-ignore
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async (e: any) => {
                const file = e.target.files[0];
                if (file) {
                    setLoading(true);
                    try {
                        const formData = new FormData();
                        formData.append('file', file);

                        const response = await fetch(`${API_BASE}/api/upload`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` },
                            body: formData
                        });

                        const data = await response.json();
                        if (response.ok) {
                            setParcelPhoto(data.url);
                        } else {
                            Alert.alert(t('common.error'), data.error || 'Upload failed');
                        }
                    } catch (err) {
                        Alert.alert(t('common.error'), 'Upload failed');
                    } finally {
                        setLoading(false);
                    }
                }
            };
            input.click();
        } else {
            Alert.alert('Mobile Upload', 'Image picker would be triggered here.');
        }
    };

    const handleCompleteBooking = async () => {
        if (!recipientName.trim() || !contactNumber.trim() || !dropLocation.trim()) {
            Alert.alert(t('common.error'), 'Please fill in all required recipient details.');
            return;
        }

        setLoading(true);
        try {
            // Hardcoded price as requested
            const price = selectedSize === 'small' ? '150' : selectedSize === 'medium' ? '280' : '450';

            const response = await fetch(`${API_BASE}/api/rides/bookings`, { // Currently using ride bookings as placeholder
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    type: 'parcel',
                    pickup,
                    dropoff,
                    parcelSize: selectedSize,
                    recipientName,
                    contactNumber,
                    dropLocation,
                    notes,
                    photoUrl: parcelPhoto,
                    price
                })
            });

            if (response.ok) {
                Alert.alert(t('common.success'), t('parcel.bookingSuccess'));
                if (onBack) onBack(); // Return to Home screen
            } else {
                const data = await response.json();
                Alert.alert(t('common.error'), data.error || 'Failed to schedule pickup');
            }
        } catch {
            Alert.alert(t('common.error'), t('login.connectionError'));
        } finally {
            setLoading(false);
        }
    };

    const renderRecipientDetails = () => (
        <View style={styles.content}>
            <TouchableOpacity onPress={() => setStep('search')} style={styles.backButton}>
                <Text style={[styles.backText, { color: colors.primary }]}>
                    ← {t('common.back')}
                </Text>
            </TouchableOpacity>

            <Text style={[styles.title, { color: colors.textColor }]}>{t('parcel.recipientDetails')}</Text>
            <View style={styles.spacer6} />
            <Text style={[styles.routeSummary, { color: colors.subtextColor }]}>
                {pickup} → {dropoff} · {t(`parcel.size${selectedSize.charAt(0).toUpperCase() + selectedSize.slice(1)}` as any)}
            </Text>

            <View style={styles.spacer24} />

            {/* Summary Card */}
            <View style={[styles.summaryCard, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}>
                <View style={styles.row}>
                    <Icon name="cube-outline" size={24} color={colors.primary} />
                    <View style={styles.summaryInfo}>
                        <Text style={[styles.summaryTitle, { color: colors.textColor }]}>
                            {t(`parcel.size${selectedSize.charAt(0).toUpperCase() + selectedSize.slice(1)}` as any)} · {selectedSize === 'small' ? '< 2 kg' : selectedSize === 'medium' ? '2-10 kg' : '> 10 kg'}
                        </Text>
                        <Text style={[styles.summarySubtitle, { color: colors.subtextColor }]}>
                            {t('parcel.pickupScheduled')} · {t('parcel.estPrice')}: ₹{selectedSize === 'small' ? '150' : selectedSize === 'medium' ? '280' : '450'}
                        </Text>
                    </View>
                    <Text style={[styles.priceTag, { color: colors.primary }]}>₹{selectedSize === 'small' ? '150' : selectedSize === 'medium' ? '280' : '450'}</Text>
                </View>
            </View>

            <View style={styles.spacer32} />

            {/* Form Fields */}
            <Text style={[styles.fieldLabel, { color: colors.subtextColor }]}>{t('parcel.recipientName')}</Text>
            <View style={styles.spacer6} />
            <TextInput
                style={[styles.input, { color: colors.textColor, backgroundColor: colors.inputFillColor, borderColor: colors.inputBorderColor }]}
                value={recipientName}
                onChangeText={setRecipientName}
                placeholder={t('parcel.recipientNamePlaceholder')}
                placeholderTextColor={colors.subtextColor}
            />

            <View style={styles.spacer16} />

            <Text style={[styles.fieldLabel, { color: colors.subtextColor }]}>{t('parcel.contactNumber')}</Text>
            <View style={styles.spacer6} />
            <TextInput
                style={[styles.input, { color: colors.textColor, backgroundColor: colors.inputFillColor, borderColor: colors.inputBorderColor }]}
                value={contactNumber}
                onChangeText={setContactNumber}
                placeholder={t('parcel.contactPlaceholder')}
                placeholderTextColor={colors.subtextColor}
                keyboardType="phone-pad"
            />

            <View style={styles.spacer16} />

            <Text style={[styles.fieldLabel, { color: colors.subtextColor }]}>{t('parcel.dropLocation')}</Text>
            <View style={styles.spacer6} />
            <TextInput
                style={[styles.input, { color: colors.textColor, backgroundColor: colors.inputFillColor, borderColor: colors.inputBorderColor }]}
                value={dropLocation}
                onChangeText={setDropLocation}
                placeholder={t('parcel.dropPlaceholder')}
                placeholderTextColor={colors.subtextColor}
            />

            <View style={styles.spacer16} />

            <Text style={[styles.fieldLabel, { color: colors.subtextColor }]}>{t('parcel.notes')}</Text>
            <View style={styles.spacer6} />
            <TextInput
                style={[styles.input, { color: colors.textColor, backgroundColor: colors.inputFillColor, borderColor: colors.inputBorderColor, height: 100 }]}
                value={notes}
                onChangeText={setNotes}
                placeholder={t('parcel.notesPlaceholder')}
                placeholderTextColor={colors.subtextColor}
                multiline
                textAlignVertical="top"
            />

            <View style={styles.spacer24} />

            {/* Photo Upload */}
            <Text style={[styles.fieldLabel, { color: colors.subtextColor }]}>{t('parcel.photoTitle')}</Text>
            <View style={styles.spacer12} />
            <TouchableOpacity 
                style={[styles.photoBox, { borderColor: colors.primary, backgroundColor: colors.inputFillColor }]}
                onPress={handlePhotoUpload}
                disabled={loading}>
                {loading ? (
                    <ActivityIndicator color={colors.primary} />
                ) : parcelPhoto ? (
                    <Image source={{ uri: parcelPhoto.startsWith('http') ? parcelPhoto : `${API_BASE}${parcelPhoto}` }} style={styles.uploadedPhoto} />
                ) : (
                    <View style={styles.photoPlaceholder}>
                        <Icon name="camera-outline" size={32} color={colors.primary} />
                        <Text style={[styles.photoActionText, { color: colors.primary }]}>{t('parcel.photoAction')}</Text>
                        <Text style={[styles.photoHint, { color: colors.subtextColor }]}>{t('parcel.photoHint')}</Text>
                    </View>
                )}
            </TouchableOpacity>

            <View style={styles.spacer40} />

            <TouchableOpacity 
                style={[styles.scheduleButton, { backgroundColor: colors.primary }, loading && { opacity: 0.7 }]}
                onPress={handleCompleteBooking}
                disabled={loading}>
                {loading ? (
                    <ActivityIndicator color="#FFF" />
                ) : (
                    <Text style={styles.scheduleButtonText}>
                        🚀 {t('parcel.schedulePickup').toUpperCase()}
                    </Text>
                )}
            </TouchableOpacity>

            <View style={styles.spacer40} />
        </View>
    );

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
            {step === 'details' ? renderRecipientDetails() : (
                <View style={styles.content}>
                    {onBack && (
                        <TouchableOpacity onPress={onBack} style={styles.backButton}>
                            <Text style={[styles.backText, { color: colors.primary }]}>
                                {t('common.back')}
                            </Text>
                        </TouchableOpacity>
                    )}
                    
                    {/* Step 1 Search UI - Existing */}
                    <View style={[styles.inputCard, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}>
                        <Text style={[styles.fieldLabel, { color: pickupLabelColor }]}>
                            {t('parcel.pickupLabel')}
                        </Text>
                        <View style={styles.spacer6} />
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    color: colors.textColor,
                                    backgroundColor: colors.inputFillColor,
                                    borderColor: colors.inputBorderColor,
                                },
                            ]}
                            value={pickup}
                            onChangeText={setPickup}
                            placeholderTextColor={colors.subtextColor}
                        />
                        
                        <View style={styles.spacer14} />
                        
                        <Text style={[styles.fieldLabel, { color: dropoffLabelColor }]}>
                            {t('parcel.dropoffLabel')}
                        </Text>
                        <View style={styles.spacer6} />
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    color: colors.textColor,
                                    backgroundColor: colors.inputFillColor,
                                    borderColor: colors.inputBorderColor,
                                },
                            ]}
                            value={dropoff}
                            onChangeText={setDropoff}
                            placeholderTextColor={colors.subtextColor}
                        />
                    </View>

                    <View style={styles.spacer24} />

                    {/* Parcel Size Section */}
                    <Text style={[styles.sectionTitle, { color: colors.subtextColor }]}>{t('parcel.sizeTitle')}</Text>
                    <View style={styles.spacer12} />
                    <View style={styles.sizeRow}>
                        {sizes.map((size) => (
                            <TouchableOpacity
                                key={size.id}
                                style={[
                                    styles.sizeCard,
                                    {
                                        backgroundColor: colors.cardColor,
                                        borderColor: selectedSize === size.id ? colors.primary : colors.borderColor,
                                        borderWidth: selectedSize === size.id ? 2 : 1,
                                    }
                                ]}
                                onPress={() => setSelectedSize(size.id as any)}>
                                <Icon 
                                    name={size.icon} 
                                    size={28} 
                                    color={selectedSize === size.id ? colors.primary : (isDark ? '#FF4081' : colors.primary)} 
                                    style={styles.sizeIcon}
                                />
                                <Text style={[styles.sizeLabel, { color: selectedSize === size.id ? colors.primary : colors.textColor }]}>
                                    {t(size.label as any)}
                                </Text>
                                <Text style={[styles.sizeDesc, { color: colors.subtextColor }]}>
                                    {t(size.desc as any)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.spacer32} />

                    <TouchableOpacity 
                        style={[styles.scheduleButton, { backgroundColor: colors.primary }]}
                        activeOpacity={0.8}
                        onPress={() => {
                            if (pickup && dropoff) setStep('details');
                            else Alert.alert(t('common.error'), 'Please enter pickup and dropoff locations.');
                        }}>
                        <Text style={styles.scheduleButtonText}>
                            🚀 {t('parcel.schedulePickup').toUpperCase()}
                        </Text>
                    </TouchableOpacity>

                    <View style={styles.spacer40} />

                    <Text style={[styles.sectionTitle, { color: colors.subtextColor }]}>{t('parcel.popularRoutes')}</Text>
                    <View style={styles.spacer14} />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.routesScroll}>
                        {popularRoutes.map((route, index) => (
                            <TouchableOpacity 
                                key={index} 
                                onPress={() => { setPickup(route.from); setDropoff(route.to); }}
                                style={[
                                    styles.routeCard, 
                                    { 
                                        backgroundColor: colors.cardColor, 
                                        borderColor: colors.borderColor,
                                    }
                                ]}>
                                <View style={styles.routeHeader}>
                                    <View style={[styles.smallDot, { backgroundColor: '#4CAF50' }]} />
                                    <Text style={[styles.routeName, { color: colors.textColor }]}>{route.from}</Text>
                                </View>
                                <View style={styles.routeFooter}>
                                    <Text style={[styles.routeArrow, { color: colors.subtextColor }]}>→</Text>
                                    <Text style={[styles.routeToName, { color: colors.subtextColor }]}>{route.to}</Text>
                                </View>
                                <Text style={[styles.routePrice, { color: '#00BFA5' }]}>₹{route.price}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 20,
    },
    backButton: {
        marginBottom: 20,
    },
    backText: {
        fontSize: 14,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    inputCard: {
        padding: 18,
        borderRadius: 20,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    fieldLabel: {
        fontWeight: 'bold',
        fontSize: 13,
        letterSpacing: 1,
    },
    input: {
        fontSize: 16,
        fontWeight: '500',
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 14,
        minHeight: 56,
        // @ts-ignore - web only property to remove the blue focus box
        outlineStyle: 'none',
    },
    spacer6: { height: 6 },
    spacer14: { height: 14 },
    spacer16: { height: 16 },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        letterSpacing: 1.2,
    },
    sizeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    sizeCard: {
        width: (width - 64) / 3,
        paddingVertical: 20,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
    },
    sizeIcon: {
        marginBottom: 8,
    },
    sizeLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    sizeDesc: {
        fontSize: 12,
        opacity: 0.8,
    },
    scheduleButton: {
        height: 64,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
    },
    scheduleButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    routesScroll: {
        marginHorizontal: -20,
        paddingHorizontal: 20,
    },
    routeCard: {
        width: 160,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        marginRight: 12,
    },
    routeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    smallDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    routeName: {
        fontSize: 15,
        fontWeight: 'bold',
    },
    routeFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    routeArrow: {
        marginHorizontal: 8,
        fontSize: 14,
    },
    routeToName: {
        fontSize: 13,
    },
    routePrice: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    spacer12: { height: 12 },
    spacer14: { height: 14 },
    spacer16: { height: 16 },
    spacer24: { height: 24 },
    spacer32: { height: 32 },
    spacer40: { height: 40 },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    routeSummary: {
        fontSize: 16,
        fontWeight: '500',
        opacity: 0.8,
    },
    summaryCard: {
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
    },
    summaryInfo: {
        flex: 1,
        marginLeft: 12,
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    summarySubtitle: {
        fontSize: 12,
        marginTop: 2,
    },
    priceTag: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    photoBox: {
        height: 160,
        borderRadius: 16,
        borderWidth: 2,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    photoPlaceholder: {
        alignItems: 'center',
    },
    photoActionText: {
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 8,
    },
    photoHint: {
        fontSize: 12,
        marginTop: 4,
    },
    uploadedPhoto: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});

export default ParcelBookingView;
