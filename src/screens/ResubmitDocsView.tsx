import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { API_BASE } from '../apiConfig';
import { apiRequest } from '../utils/api';

interface ResubmitDocsViewProps {
    onClose: () => void;
}

const ResubmitDocsView: React.FC<ResubmitDocsViewProps> = ({ onClose }) => {
    const { token, user, setAuth, logout } = useAuth();
    const { colors, isDark } = useTheme();
    const { t } = useLanguage();

    const [loading, setLoading] = useState(false);
    const [showDocSubmittedModal, setShowDocSubmittedModal] = useState(false);
    
    // Pre-fill with existing vehicle details if available
    const [vehicleDocs, setVehicleDocs] = useState({
        name: user?.vehicle?.vehicle_name || '',
        type: user?.vehicle?.vehicle_type || '',
        seats: user?.vehicle?.seats?.toString() || '',
        number: user?.vehicle?.vehicle_number || '',
        dl: user?.vehicle?.dl_url || '',
        rc: user?.vehicle?.rc_url || '',
        pollution: user?.vehicle?.pollution_url || '',
        image: user?.vehicle?.vehicle_image_url || '',
        ownership: user?.vehicle?.ownership_url || '',
        layout: user?.vehicle?.seating_layout || 'suv'
    });

    const handleFileUpload = (type: keyof typeof vehicleDocs) => {
        if (Platform.OS === 'web' || typeof document !== 'undefined') {
            // @ts-ignore
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*,application/pdf';
            input.onchange = async (e: any) => {
                const file = e.target.files[0];
                if (file) {
                    setLoading(true);
                    try {
                        const formData = new FormData();
                        formData.append('file', file);

                        const response = await fetch(`${API_BASE}/api/upload`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`
                            },
                            body: formData
                        });

                        const data = await response.json();
                        if (response.ok) {
                            setVehicleDocs(prev => ({ ...prev, [type]: data.url }));
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
            Alert.prompt(
                'Upload Document',
                'Enter document image URL or tap OK to upload demo document:',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Upload',
                        onPress: (url) => {
                            const finalUrl = url && url.trim() ? url.trim() : 'https://via.placeholder.com/600x400.png?text=Document+Uploaded';
                            setVehicleDocs(prev => ({ ...prev, [type]: finalUrl }));
                        }
                    }
                ],
                'plain-text',
                'https://via.placeholder.com/600x400.png?text=Document+Uploaded'
            );
        }
    };

    const handleCompleteRegistration = async () => {
        if (!vehicleDocs.name || !vehicleDocs.type || !vehicleDocs.seats || !vehicleDocs.number) {
            Alert.alert(t('common.error'), 'Please fill in all vehicle details (Name, Type, Seats, Number).');
            return;
        }
        if (!vehicleDocs.dl || !vehicleDocs.rc || !vehicleDocs.pollution || !vehicleDocs.image) {
            Alert.alert(t('common.error'), t('login.uploadError'));
            return;
        }

        setLoading(true);
        try {
            const body: any = {
                name: user?.name,
                role: 'driver',
                vehicle: {
                    vehicle_name: vehicleDocs.name,
                    vehicle_type: vehicleDocs.type,
                    seats: parseInt(vehicleDocs.seats) || 0,
                    vehicle_number: vehicleDocs.number,
                    dl_url: vehicleDocs.dl,
                    rc_url: vehicleDocs.rc,
                    pollution_url: vehicleDocs.pollution,
                    vehicle_image_url: vehicleDocs.image,
                    ownership_url: vehicleDocs.ownership,
                    seating_layout: vehicleDocs.layout
                }
            };

            const response = await apiRequest('/api/user/profile', {
                method: 'PUT',
                body: JSON.stringify(body),
            }, logout);

            if (response.ok) {
                const updatedUser = {
                    ...user,
                    vehicle: body.vehicle,
                    verification_status: 'pending',
                };
                await setAuth(token, null, updatedUser as any);
                setShowDocSubmittedModal(true);
            } else {
                Alert.alert(t('common.error'), t('login.failProfile'));
            }
        } catch {
            Alert.alert(t('common.error'), t('login.connectionError'));
        } finally {
            setLoading(false);
        }
    };

    if (showDocSubmittedModal) {
        return (
            <View style={[{ flex: 1 }, { backgroundColor: isDark ? '#0A1628' : '#F0F7FF', justifyContent: 'center', alignItems: 'center', padding: 28 }]}>
                {/* Glow ring */}
                <View style={{
                    width: 140, height: 140, borderRadius: 70,
                    backgroundColor: 'rgba(0,191,165,0.08)',
                    justifyContent: 'center', alignItems: 'center',
                    borderWidth: 2, borderColor: 'rgba(0,191,165,0.25)',
                    marginBottom: 32,
                }}>
                    <View style={{
                        width: 100, height: 100, borderRadius: 50,
                        backgroundColor: 'rgba(0,191,165,0.15)',
                        justifyContent: 'center', alignItems: 'center',
                        borderWidth: 2, borderColor: '#00BFA5',
                    }}>
                        <Text style={{ fontSize: 48 }}>✅</Text>
                    </View>
                </View>

                <Text style={{ fontSize: 26, fontWeight: '800', color: '#00BFA5', textAlign: 'center', marginBottom: 12, letterSpacing: 0.3 }}>
                    Documents Submitted!
                </Text>
                <Text style={{ fontSize: 15, color: isDark ? '#94A3B8' : '#64748B', textAlign: 'center', lineHeight: 24, marginBottom: 36 }}>
                    Your vehicle documents have been submitted and are{' '}
                    <Text style={{ fontWeight: '700', color: isDark ? '#CBD5E1' : '#334155' }}>under review</Text>.{'\n\n'}
                    Our admin team will verify your documents and you will receive a{' '}
                    <Text style={{ fontWeight: '700', color: isDark ? '#CBD5E1' : '#334155' }}>notification</Text>{' '}
                    once approved or if any action is required.
                </Text>

                {/* Status steps */}
                {[
                    { icon: '📄', label: 'Documents Received', done: true },
                    { icon: '🔍', label: 'Under Admin Review', done: false },
                    { icon: '✅', label: 'Approval & Activation', done: false },
                ].map((step, i) => (
                    <View key={i} style={{
                        flexDirection: 'row', alignItems: 'center',
                        width: '100%', marginBottom: 14,
                        paddingHorizontal: 8,
                    }}>
                        <View style={{
                            width: 40, height: 40, borderRadius: 20,
                            backgroundColor: step.done ? 'rgba(0,191,165,0.15)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                            justifyContent: 'center', alignItems: 'center',
                            borderWidth: 1,
                            borderColor: step.done ? '#00BFA5' : (isDark ? '#334155' : '#E2E8F0'),
                            marginRight: 14,
                        }}>
                            <Text style={{ fontSize: 18 }}>{step.icon}</Text>
                        </View>
                        <Text style={{
                            fontSize: 15, fontWeight: step.done ? '700' : '500',
                            color: step.done ? '#00BFA5' : (isDark ? '#64748B' : '#94A3B8'),
                        }}>
                            {step.label}
                        </Text>
                        {step.done && <Text style={{ marginLeft: 'auto', color: '#00BFA5', fontWeight: '700' }}>✓</Text>}
                    </View>
                ))}

                <TouchableOpacity
                    style={{
                        marginTop: 32,
                        width: '100%',
                        paddingVertical: 16,
                        borderRadius: 16,
                        backgroundColor: '#00BFA5',
                        alignItems: 'center',
                        shadowColor: '#00BFA5',
                        shadowOpacity: 0.35,
                        shadowRadius: 12,
                        elevation: 6,
                    }}
                    onPress={onClose}
                    activeOpacity={0.85}>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 }}>
                        Go to Dashboard
                    </Text>
                </TouchableOpacity>

                <Text style={{ marginTop: 18, fontSize: 12, color: isDark ? '#475569' : '#94A3B8', textAlign: 'center' }}>
                    You can check the status anytime in your notifications 🔔
                </Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={[{ flex: 1 }, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 48 }}
                showsVerticalScrollIndicator={false}>

                {/* Header */}
                <View style={[kycStyles.pageHeader, { backgroundColor: colors.primary }]}>
                    <TouchableOpacity onPress={onClose} style={kycStyles.backBtn}>
                        <Text style={{ color: '#fff', fontSize: 22, lineHeight: 26 }}>←</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={kycStyles.pageHeaderTitle}>Resubmit Driver KYC</Text>
                        <Text style={kycStyles.pageHeaderSub}>Vehicle & Document Verification</Text>
                    </View>
                    <View style={{ width: 40 }} />
                </View>

                <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>

                    {/* Section 1: Vehicle Info */}
                    <View style={[kycStyles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
                        <View style={kycStyles.cardHeader}>
                            <Text style={kycStyles.cardIcon}>🚗</Text>
                            <Text style={[kycStyles.cardTitle, { color: colors.textColor }]}>Vehicle Information</Text>
                        </View>

                        <TextInput
                            style={[kycStyles.kycInput, {
                                backgroundColor: isDark ? '#0F172A' : '#F1F5F9',
                                color: colors.textColor,
                                borderColor: vehicleDocs.name ? colors.primary : (isDark ? '#334155' : '#E2E8F0')
                            }]}
                            placeholder="Vehicle Name (e.g. Tata Sumo Gold)"
                            placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
                            value={vehicleDocs.name}
                            onChangeText={text => setVehicleDocs(p => ({ ...p, name: text }))}
                        />
                        <TextInput
                            style={[kycStyles.kycInput, {
                                backgroundColor: isDark ? '#0F172A' : '#F1F5F9',
                                color: colors.textColor,
                                borderColor: vehicleDocs.type ? colors.primary : (isDark ? '#334155' : '#E2E8F0')
                            }]}
                            placeholder="Vehicle Type (e.g. SUV, Van, Sedan, Bus)"
                            placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
                            autoCapitalize="words"
                            value={vehicleDocs.type}
                            onChangeText={text => setVehicleDocs(p => ({ ...p, type: text }))}
                        />
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TextInput
                                style={[kycStyles.kycInput, {
                                    flex: 1,
                                    backgroundColor: isDark ? '#0F172A' : '#F1F5F9',
                                    color: colors.textColor,
                                    borderColor: vehicleDocs.seats ? colors.primary : (isDark ? '#334155' : '#E2E8F0')
                                }]}
                                placeholder="Seats"
                                placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
                                keyboardType="number-pad"
                                value={vehicleDocs.seats}
                                onChangeText={text => setVehicleDocs(p => ({ ...p, seats: text.replace(/[^0-9]/g, '') }))}
                            />
                            <TextInput
                                style={[kycStyles.kycInput, {
                                    flex: 2,
                                    backgroundColor: isDark ? '#0F172A' : '#F1F5F9',
                                    color: colors.textColor,
                                    borderColor: vehicleDocs.number ? colors.primary : (isDark ? '#334155' : '#E2E8F0')
                                }]}
                                placeholder="Vehicle Number (e.g. HP12AB3456)"
                                placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
                                autoCapitalize="characters"
                                value={vehicleDocs.number}
                                onChangeText={text => setVehicleDocs(p => ({ ...p, number: text }))}
                            />
                        </View>
                    </View>

                    {/* Section 2: Seating Layout */}
                    <View style={[kycStyles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
                        <View style={kycStyles.cardHeader}>
                            <Text style={kycStyles.cardIcon}>💺</Text>
                            <Text style={[kycStyles.cardTitle, { color: colors.textColor }]}>Seating Arrangement</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            {[
                                { id: 'sedan', icon: '🚗', label: 'Small Car\nSedan' },
                                { id: 'suv', icon: '🚙', label: 'SUV / Jeep\n4×4' },
                                { id: 'bus_2x2', icon: '🚌', label: 'Bus\n2×2 Layout' },
                            ].map(layout => (
                                <TouchableOpacity
                                    key={layout.id}
                                    style={[
                                        kycStyles.layoutCard,
                                        {
                                            backgroundColor: vehicleDocs.layout === layout.id
                                                ? colors.primary
                                                : (isDark ? '#0F172A' : '#F1F5F9'),
                                            borderColor: vehicleDocs.layout === layout.id
                                                ? colors.primary
                                                : (isDark ? '#334155' : '#E2E8F0'),
                                        }
                                    ]}
                                    onPress={() => setVehicleDocs(p => ({ ...p, layout: layout.id as any }))}
                                >
                                    <Text style={{ fontSize: 28, marginBottom: 6 }}>{layout.icon}</Text>
                                    <Text style={[
                                        kycStyles.layoutLabel,
                                        { color: vehicleDocs.layout === layout.id ? '#FFFFFF' : colors.textColor }
                                    ]}>{layout.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Section 3: Documents */}
                    <View style={[kycStyles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
                        <View style={kycStyles.cardHeader}>
                            <Text style={kycStyles.cardIcon}>📋</Text>
                            <Text style={[kycStyles.cardTitle, { color: colors.textColor }]}>Required Documents</Text>
                        </View>
                        <Text style={{ color: isDark ? '#64748B' : '#94A3B8', fontSize: 12, marginBottom: 16 }}>
                            Please upload the correct documents. All documents must be clear and legible. Accepted: JPG, PNG, PDF
                        </Text>

                        {[
                            { key: 'dl', icon: '🪪', label: 'Driving License', sub: 'Front and back of your DL', required: true },
                            { key: 'rc', icon: '📄', label: 'RC Book', sub: 'Vehicle Registration Certificate', required: true },
                            { key: 'pollution', icon: '🌿', label: 'Pollution Certificate', sub: 'Valid PUC Certificate', required: true },
                            { key: 'image', icon: '📷', label: 'Vehicle Photo', sub: 'Number plate must be clearly visible', required: true },
                            { key: 'ownership', icon: '📝', label: 'Ownership Proof', sub: 'Any document establishing owner-vehicle relation', required: false },
                        ].map(doc => {
                            const isUploaded = !!(vehicleDocs as any)[doc.key];
                            return (
                                <TouchableOpacity
                                    key={doc.key}
                                    style={[
                                        kycStyles.docRow,
                                        {
                                            backgroundColor: isUploaded
                                                ? (isDark ? 'rgba(34,197,94,0.1)' : '#F0FDF4')
                                                : (isDark ? '#0F172A' : '#F8FAFC'),
                                            borderColor: isUploaded
                                                ? '#22C55E'
                                                : (isDark ? '#334155' : '#E2E8F0'),
                                        }
                                    ]}
                                    onPress={() => handleFileUpload(doc.key as any)}
                                    activeOpacity={0.7}
                                >
                                    <View style={[kycStyles.docIconBox, { backgroundColor: isUploaded ? '#22C55E' : colors.primary + '20' }]}>
                                        <Text style={{ fontSize: 20 }}>{isUploaded ? '✅' : doc.icon}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={[kycStyles.docLabel, { color: colors.textColor }]}>{doc.label}</Text>
                                            {doc.required && !isUploaded && (
                                                <View style={kycStyles.reqBadge}><Text style={{ color: '#EF4444', fontSize: 9, fontWeight: '700' }}>REQUIRED</Text></View>
                                            )}
                                        </View>
                                        <Text style={[kycStyles.docSub, { color: isDark ? '#64748B' : '#94A3B8' }]}>
                                            {isUploaded ? '✓ Uploaded successfully' : doc.sub}
                                        </Text>
                                    </View>
                                    <View style={[kycStyles.uploadChip, {
                                        backgroundColor: isUploaded ? '#22C55E' : colors.primary,
                                    }]}>
                                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                                            {isUploaded ? 'Change' : 'Upload'}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Submit */}
                    <TouchableOpacity
                        style={[
                            kycStyles.submitBtn,
                            { backgroundColor: colors.primary },
                            loading && { opacity: 0.7 }
                        ]}
                        onPress={handleCompleteRegistration}
                        activeOpacity={0.85}
                        disabled={loading}>
                        {loading ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <>
                                <Text style={kycStyles.submitBtnText}>Resubmit Documents</Text>
                            </>
                        )}
                    </TouchableOpacity>

                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const kycStyles = StyleSheet.create({
    pageHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: Platform.OS === 'web' ? 20 : 52,
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    backBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pageHeaderTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    pageHeaderSub: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 12,
        marginTop: 2,
    },
    card: {
        borderRadius: 16,
        padding: 20,
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
        marginBottom: 16,
        gap: 10,
    },
    cardIcon: {
        fontSize: 22,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '700',
    },
    kycInput: {
        fontSize: 14,
        paddingVertical: 13,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1.5,
        marginBottom: 12,
    },
    layoutCard: {
        flex: 1,
        borderRadius: 12,
        borderWidth: 1.5,
        padding: 14,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 90,
    },
    layoutLabel: {
        fontSize: 11,
        fontWeight: '700',
        textAlign: 'center',
        lineHeight: 15,
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
    reqBadge: {
        backgroundColor: 'rgba(239,68,68,0.1)',
        borderRadius: 4,
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.3)',
    },
    uploadChip: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 62,
    },
    submitBtn: {
        borderRadius: 14,
        paddingVertical: 18,
        alignItems: 'center',
        marginTop: 8,
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    submitBtnText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 16,
    },
});

export default ResubmitDocsView;
