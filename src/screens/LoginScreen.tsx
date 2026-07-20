import React, { useState, useEffect } from 'react';
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
    Dimensions,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { API_BASE } from '../apiConfig';
import Icon from 'react-native-vector-icons/Ionicons';

interface LoginScreenProps {
    onAuthenticated: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onAuthenticated }) => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [name, setName] = useState('');
    const [step, setStep] = useState<'phone' | 'otp' | 'name' | 'consent' | 'role' | 'vehicle' | 'admin_phone' | 'admin_otp' | 'admin_secret'>('phone');
    const [consentChecked, setConsentChecked] = useState(false);
    const [adminSecretKey, setAdminSecretKey] = useState('');
    const [adminTempToken, setAdminTempToken] = useState<string | null>(null);
    const [adminTempUser, setAdminTempUser] = useState<any | null>(null);
    const [vehicleDocs, setVehicleDocs] = useState({
        name: '',
        type: '',
        seats: '',
        number: '',
        dl: '',
        rc: '',
        pollution: '',
        image: '',
        ownership: '',
        layout: 'suv'
    });
    const [loading, setLoading] = useState(false);
    const { token, user, setAuth } = useAuth();
    const { colors, isDark } = useTheme();
    const { t } = useLanguage();

    const [tempToken, setTempToken] = useState<string | null>(null);
    const [tempRefreshToken, setTempRefreshToken] = useState<string | null>(null);
    const [tempUser, setTempUser] = useState<any | null>(null);

    useEffect(() => {
        if (Platform.OS === 'web') {
            const w = globalThis as any;
            if (w.window && w.window.location) {
                const params = new URLSearchParams(w.window.location.search);
                if (params.get('admin') === 'true') {
                    setPhoneNumber('');
                    setOtp('');
                    setStep('admin_phone');
                }
            }
        }
    }, [setStep]);

    const handleSendOtp = async (isAdmin = false) => {
        if (phoneNumber.trim().length !== 10) {
            Alert.alert(t('common.error'), t('login.invalidPhone'));
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/auth/otp/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone_number: phoneNumber.trim() }),
            });

            const data = await response.json();

            if (!response.ok) {
                Alert.alert(t('common.error'), data.error || t('common.error'));
                return;
            }

            setStep(isAdmin ? 'admin_otp' : 'otp');
            if (data.otp) {
                setOtp(data.otp);
                Alert.alert(
                    isAdmin ? 'Admin OTP (Dev Mode)' : 'OTP (Dev Mode)',
                    `Your OTP is: ${data.otp}. It has been autofilled for you.`
                );
            } else {
                Alert.alert(t('login.otpSent'), t('login.otpSentMessage'));
            }
        } catch {
            Alert.alert(t('common.error'), t('login.connectionError'));
        } finally {
            setLoading(false);
        }
    };

    const handleAdminVerifyOtp = async () => {
        if (!otp.trim()) { Alert.alert('Error', 'Enter OTP'); return; }
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/auth/otp/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone_number: phoneNumber.trim(), otp: otp.trim() }),
            });
            const data = await response.json();
            if (!response.ok) { Alert.alert('Error', data.error || 'Invalid OTP'); return; }
            setAdminTempToken(data.token);
            setAdminTempUser(data.user);
            setStep('admin_secret');
        } catch {
            Alert.alert('Error', 'Connection error');
        } finally { setLoading(false); }
    };

    const handleAdminPromote = async () => {
        if (!adminSecretKey.trim()) { Alert.alert('Error', 'Enter secret key'); return; }
        setLoading(true);
        try {
            const promoteRes = await fetch(`${API_BASE}/api/auth/promote-admin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminTempToken}` },
                body: JSON.stringify({ secret_key: adminSecretKey.trim() }),
            });
            const promoteData = await promoteRes.json();
            if (!promoteRes.ok) {
                Alert.alert('Access Denied', promoteData.error || 'Invalid secret key');
                return;
            }
            // Just proceed with auth using the updated role
            // Set admin user with updated role
            await setAuth(adminTempToken, null, { ...adminTempUser, role: 'admin' });
            onAuthenticated();
        } catch {
            Alert.alert('Error', 'Promotion failed. Check secret key.');
        } finally { setLoading(false); }
    };

    const handleVerifyOtp = async () => {
        if (!otp.trim()) {
            Alert.alert(t('common.error'), t('login.enterOtpError'));
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/auth/otp/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone_number: phoneNumber.trim(), otp: otp.trim() }),
            });

            const data = await response.json();

            if (!response.ok) {
                Alert.alert(t('common.error'), data.error || t('login.invalidOtp'));
                return;
            }

            if (!data.user.name || !data.user.role) {
                setTempToken(data.token || null);
                setTempRefreshToken(data.refresh_token || null);
                setTempUser(data.user);

                if (!data.user.name) {
                    setStep('name');
                } else {
                    // Has name but no role
                    setName(data.user.name);
                    setStep('consent');
                }
            } else {
                await setAuth(data.token, data.refresh_token, data.user);
                onAuthenticated();
            }
        } catch {
            Alert.alert(t('common.error'), t('login.connectionError'));
        } finally {
            setLoading(false);
        }
    };

    const handleSaveName = () => {
        if (!name.trim()) {
            Alert.alert(t('common.error'), t('login.enterNameError'));
            return;
        }
        setStep('consent');
    };

    const handleRoleSelect = (role: 'passenger' | 'driver' | 'parceller') => {
        if (role === 'passenger' || role === 'parceller') {
            handleCompleteRegistration(role);
        } else {
            setStep('vehicle');
        }
    };

    const handleFileUpload = (type: keyof typeof vehicleDocs) => {
        const activeToken = tempToken || token;
        if (Platform.OS === 'web') {
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
                                'Authorization': `Bearer ${activeToken}`
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
            Alert.alert('Mobile Upload', 'Image picker would be triggered here.');
        }
    };

    const handleCompleteRegistration = async (role: 'passenger' | 'driver' | 'parceller') => {
        const activeToken = tempToken || token;

        if (role === 'driver') {
            if (!vehicleDocs.name || !vehicleDocs.type || !vehicleDocs.seats || !vehicleDocs.number) {
                Alert.alert(t('common.error'), 'Please fill in all vehicle details (Name, Type, Seats, Number).');
                return;
            }
            if (!vehicleDocs.dl || !vehicleDocs.rc || !vehicleDocs.pollution || !vehicleDocs.image) {
                Alert.alert(t('common.error'), t('login.uploadError'));
                return;
            }
        }

        setLoading(true);
        try {
            const body: any = {
                name: name.trim(),
                role: role
            };

            if (role === 'driver') {
                body.vehicle = {
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
                };
            }

            const response = await fetch(`${API_BASE}/api/user/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${activeToken}`
                },
                body: JSON.stringify(body),
            });

            if (response.ok) {
                const updatedUser = {
                    ...(tempUser || user),
                    name: name.trim(),
                    role: role,
                    vehicle: body.vehicle
                };
                await setAuth(activeToken, tempRefreshToken, updatedUser);
                onAuthenticated();
            } else {
                Alert.alert(t('common.error'), t('login.failProfile'));
            }
        } catch {
            Alert.alert(t('common.error'), t('login.connectionError'));
        } finally {
            setLoading(false);
        }
    };

    // ─── Full-page KYC form for the vehicle step ───────────────────────────
    if (step === 'vehicle') {
        return (
            <KeyboardAvoidingView
                style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: 48 }}
                    showsVerticalScrollIndicator={false}>

                    {/* Header */}
                    <View style={[kycStyles.pageHeader, { backgroundColor: colors.primary }]}>
                        <TouchableOpacity onPress={() => setStep('role')} style={kycStyles.backBtn}>
                            <Text style={{ color: '#fff', fontSize: 22, lineHeight: 26 }}>←</Text>
                        </TouchableOpacity>
                        <View style={{ flex: 1, alignItems: 'center' }}>
                            <Text style={kycStyles.pageHeaderTitle}>Driver KYC</Text>
                            <Text style={kycStyles.pageHeaderSub}>Vehicle & Document Verification</Text>
                        </View>
                        <View style={{ width: 40 }} />
                    </View>

                    <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>

                        {/* Progress indicator */}
                        <View style={kycStyles.progressRow}>
                            {['Vehicle Info', 'Seating', 'Documents'].map((label, i) => (
                                <View key={i} style={{ alignItems: 'center', flex: 1 }}>
                                    <View style={[kycStyles.progressDot, { backgroundColor: colors.primary }]}>
                                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{i + 1}</Text>
                                    </View>
                                    <Text style={[kycStyles.progressLabel, { color: colors.subtextColor }]}>{label}</Text>
                                </View>
                            ))}
                            <View style={[kycStyles.progressLine, { backgroundColor: colors.primary, left: '17%' }]} />
                            <View style={[kycStyles.progressLine, { backgroundColor: colors.primary, left: '50%' }]} />
                        </View>

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
                                All documents must be clear and legible. Accepted: JPG, PNG, PDF
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
                            onPress={() => handleCompleteRegistration('driver')}
                            activeOpacity={0.85}
                            disabled={loading}>
                            {loading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <>
                                    <Text style={kycStyles.submitBtnText}>Submit & Complete Registration</Text>
                                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 }}>Your documents will be verified within 24 hours</Text>
                                </>
                            )}
                        </TouchableOpacity>

                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        );
    }

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.inner}>
                <Text style={[styles.title, { color: colors.textColor }]}>
                    {step === 'name' ? t('login.enterName') :
                        step === 'role' ? t('login.chooseRole') :
                            step === 'consent' ? 'User Consent' :
                                t('login.moveFreely')}
                </Text>

                <View style={styles.spacer16} />

                <Text style={[styles.subtitle, { color: colors.subtextColor }]}>
                    {step === 'name'
                        ? t('login.helpDrivers')
                        : step === 'role'
                            ? t('login.howUseRaahi')
                            : step === 'consent'
                                ? 'Please review our terms of use'
                                : t('login.localTrusted')}
                </Text>

                <View style={styles.spacer40} />

                {step === 'phone' && (
                    <>
                        <TextInput
                            style={[styles.input, {
                                backgroundColor: colors.inputFillColor,
                                color: colors.textColor,
                                borderColor: colors.inputBorderColor
                            }]}
                            placeholder={t('login.phonePlaceholder')}
                            placeholderTextColor={isDark ? 'rgba(255,255,255,0.24)' : 'rgba(34,34,96,0.3)'}
                            keyboardType="phone-pad"
                            autoCapitalize="none"
                            value={phoneNumber}
                            onChangeText={(text) => setPhoneNumber(text.replace(/[^0-9]/g, '').slice(0, 10))}
                            maxLength={10}
                        />

                        <View style={styles.spacer24} />

                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
                            onPress={() => handleSendOtp(false)}
                            activeOpacity={0.85}
                            disabled={loading}>
                            {loading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.buttonText}>{t('login.sendOtp')}</Text>
                            )}
                        </TouchableOpacity>
                    </>
                )}

                {step === 'otp' && (
                    <>
                        <TextInput
                            style={[styles.input, {
                                backgroundColor: colors.inputFillColor,
                                color: colors.textColor,
                                borderColor: colors.inputBorderColor
                            }]}
                            placeholder={t('login.enterOtp')}
                            placeholderTextColor={isDark ? 'rgba(255,255,255,0.24)' : 'rgba(34,34,96,0.3)'}
                            keyboardType="number-pad"
                            autoCapitalize="none"
                            value={otp}
                            onChangeText={setOtp}
                            maxLength={6}
                        />

                        <View style={styles.spacer12} />

                        <TouchableOpacity onPress={() => setStep('phone')}>
                            <Text style={[styles.switchText, { color: colors.primary }]}>{t('login.changePhone')}</Text>
                        </TouchableOpacity>

                        <View style={styles.spacer24} />

                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
                            onPress={handleVerifyOtp}
                            activeOpacity={0.85}
                            disabled={loading}>
                            {loading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.buttonText}>{t('login.verifyOtp')}</Text>
                            )}
                        </TouchableOpacity>
                    </>
                )}

                {step === 'name' && (
                    <>
                        <TextInput
                            style={[styles.input, {
                                backgroundColor: colors.inputFillColor,
                                color: colors.textColor,
                                borderColor: colors.inputBorderColor
                            }]}
                            placeholder={t('login.fullName')}
                            placeholderTextColor={isDark ? 'rgba(255,255,255,0.24)' : 'rgba(34,34,96,0.3)'}
                            autoCapitalize="words"
                            value={name}
                            onChangeText={setName}
                        />

                        <View style={styles.spacer24} />

                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
                            onPress={handleSaveName}
                            activeOpacity={0.85}
                            disabled={loading}>
                            {loading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.buttonText}>{t('login.continue')}</Text>
                            )}
                        </TouchableOpacity>
                    </>
                )}

                {step === 'role' && (
                    <View style={styles.roleContainer}>
                        <TouchableOpacity
                            style={[styles.roleCard, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}
                            onPress={() => handleRoleSelect('passenger')}>
                            <Text style={styles.roleEmoji}>🏠</Text>
                            <View style={styles.roleInfo}>
                                <Text style={[styles.roleLabel, { color: colors.textColor }]}>{t('login.iAmPassenger')}</Text>
                                <Text style={[styles.roleDesc, { color: colors.subtextColor }]}>{t('login.bookLocal')}</Text>
                            </View>
                        </TouchableOpacity>

                        <View style={styles.spacer16} />

                        <TouchableOpacity
                            style={[styles.roleCard, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}
                            onPress={() => handleRoleSelect('driver')}>
                            <Text style={styles.roleEmoji}>🚕</Text>
                            <View style={styles.roleInfo}>
                                <Text style={[styles.roleLabel, { color: colors.textColor }]}>{t('login.iAmDriver')}</Text>
                                <Text style={[styles.roleDesc, { color: colors.subtextColor }]}>{t('login.provideLocal')}</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                )}

                {step === 'consent' && (
                    <View style={styles.consentContainer}>
                        <ScrollView style={[styles.consentBox, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}>
                            <Text style={[styles.consentTitle, { color: colors.textColor }]}>
                                GORAAHI USER CONSENT & ACKNOWLEDGEMENT
                            </Text>
                            <Text style={[styles.consentIntro, { color: colors.textColor }]}>
                                By selecting the checkbox and continuing to use GoRaahi, I acknowledge and agree that:
                            </Text>
                            {[
                                "I am at least 18 years old and legally capable of entering into a binding agreement.",
                                "I have read and understood GoRaahi’s Terms & Conditions and Privacy Policy.",
                                "I understand that GoRaahi operates as a technology platform that connects passengers with independent drivers and transport operators.",
                                "I understand that GoRaahi does not currently own, operate, or control transportation vehicles unless specifically stated otherwise.",
                                "I agree to provide accurate and complete information during registration and booking.",
                                "I understand that fare estimates may vary based on route, demand, weather conditions, tolls, taxes, operator charges, or other applicable fees.",
                                "I understand that transportation services are provided by independent drivers and operators who remain responsible for maintaining valid licences, permits, registrations, insurance, and legal compliance.",
                                "I understand that travel in mountainous and remote regions may involve additional risks, including weather disruptions, road closures, landslides, mechanical failures, communication outages, and delays.",
                                "I agree to follow all safety instructions provided by drivers, operators, authorities, or GoRaahi.",
                                "I consent to the collection, processing, storage, and sharing of my personal information as described in the Privacy Policy.",
                                "I consent to the use of my location information where necessary for booking, route management, safety, customer support, fraud prevention, and service improvement.",
                                "I understand that GoRaahi may contact me through phone calls, SMS, WhatsApp, email, push notifications, or other communication channels regarding my bookings, account activity, safety notifications, and support requests.",
                                "I understand that refunds and cancellations are subject to GoRaahi’s published Cancellation and Refund Policy.",
                                "I agree not to engage in fraudulent, abusive, unlawful, threatening, discriminatory, or harmful conduct while using the platform.",
                                "I understand that violation of platform policies may result in suspension or termination of my account.",
                                "I acknowledge that GoRaahi may cooperate with law enforcement authorities and government agencies when legally required.",
                                "I understand that GoRaahi may update its policies from time to time and that continued use of the platform may constitute acceptance of revised policies.",
                                "I voluntarily consent to these terms and wish to continue using the GoRaahi platform."
                            ].map((point, index) => (
                                <View key={index} style={styles.consentPoint}>
                                    <Text style={[styles.consentPointText, { color: colors.subtextColor }]}>
                                        {index + 1}. {point}
                                    </Text>
                                </View>
                            ))}
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.checkboxContainer}
                            onPress={() => setConsentChecked(!consentChecked)}
                            activeOpacity={0.8}>
                            <View style={[styles.checkbox, { borderColor: colors.primary, backgroundColor: consentChecked ? colors.primary : 'transparent' }]}>
                                {consentChecked && <Icon name="checkmark" size={14} color="#FFF" />}
                            </View>
                            <Text style={[styles.checkboxLabel, { color: colors.textColor }]}>
                                I voluntarily consent to these terms and wish to continue using the GoRaahi platform.
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: colors.primary }, !consentChecked && styles.buttonDisabled]}
                            onPress={() => setStep('role')}
                            disabled={!consentChecked}>
                            <Text style={styles.buttonText}>{t('login.continue')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => setStep('name')} style={styles.backButton}>
                            <Text style={[styles.switchText, { color: colors.primary }]}>{t('common.back')}</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* --- Admin login flow --- */}
                {step === 'admin_phone' && (
                    <>
                        <View style={[styles.adminBanner, { backgroundColor: '#0F2A1E', borderColor: '#1FAF63' }]}>
                            <Text style={{ color: '#1FAF63', fontWeight: 'bold', fontSize: 13 }}>⚙️  ADMIN ACCESS</Text>
                        </View>
                        <View style={styles.spacer16} />
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.inputFillColor, color: colors.textColor, borderColor: '#1FAF63' }]}
                            placeholder="Admin phone number"
                            placeholderTextColor="rgba(31,175,99,0.4)"
                            keyboardType="phone-pad"
                            value={phoneNumber}
                            onChangeText={(text) => setPhoneNumber(text.replace(/[^0-9]/g, '').slice(0, 10))}
                            maxLength={10}
                        />
                        <View style={styles.spacer24} />
                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: '#1FAF63' }, loading && styles.buttonDisabled]}
                            onPress={() => handleSendOtp(true)}
                            disabled={loading}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send OTP</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity style={{ marginTop: 16 }} onPress={() => setStep('phone')}>
                            <Text style={[styles.switchText, { color: colors.subtextColor }]}>← Back to regular login</Text>
                        </TouchableOpacity>
                    </>
                )}

                {step === 'admin_otp' && (
                    <>
                        <View style={[styles.adminBanner, { backgroundColor: '#0F2A1E', borderColor: '#1FAF63' }]}>
                            <Text style={{ color: '#1FAF63', fontWeight: 'bold', fontSize: 13 }}>⚙️  ADMIN ACCESS — Step 2 of 3</Text>
                        </View>
                        <View style={styles.spacer16} />
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.inputFillColor, color: colors.textColor, borderColor: '#1FAF63' }]}
                            placeholder="Enter OTP"
                            placeholderTextColor="rgba(31,175,99,0.4)"
                            keyboardType="number-pad"
                            value={otp}
                            onChangeText={setOtp}
                            maxLength={6}
                        />
                        <View style={styles.spacer24} />
                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: '#1FAF63' }, loading && styles.buttonDisabled]}
                            onPress={handleAdminVerifyOtp}
                            disabled={loading}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify OTP</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity style={{ marginTop: 16 }} onPress={() => setStep('admin_phone')}>
                            <Text style={[styles.switchText, { color: colors.subtextColor }]}>← Change number</Text>
                        </TouchableOpacity>
                    </>
                )}

                {step === 'admin_secret' && (
                    <>
                        <View style={[styles.adminBanner, { backgroundColor: '#0F2A1E', borderColor: '#1FAF63' }]}>
                            <Text style={{ color: '#1FAF63', fontWeight: 'bold', fontSize: 13 }}>⚙️  ADMIN ACCESS — Step 3 of 3</Text>
                        </View>
                        <View style={styles.spacer16} />
                        <Text style={{ color: colors.subtextColor, fontSize: 13, marginBottom: 10 }}>Enter the admin secret key provided by your system administrator.</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.inputFillColor, color: colors.textColor, borderColor: '#1FAF63' }]}
                            placeholder="Secret key"
                            placeholderTextColor="rgba(31,175,99,0.4)"
                            autoCapitalize="none"
                            secureTextEntry
                            value={adminSecretKey}
                            onChangeText={setAdminSecretKey}
                        />
                        <View style={styles.spacer24} />
                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: '#1FAF63' }, loading && styles.buttonDisabled]}
                            onPress={handleAdminPromote}
                            disabled={loading}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Access Admin Dashboard →</Text>}
                        </TouchableOpacity>
                    </>
                )}

                <View style={styles.spacer24} />

                <Text style={[styles.disclaimer, { color: colors.subtextColor, opacity: 0.6 }]}>
                    {t('login.disclaimer')}
                </Text>

                {/* Admin access link — small but readable */}
                <TouchableOpacity
                    onPress={() => setStep('admin_phone')}
                    style={styles.adminAccessButton}>
                    <Text style={{ fontSize: 11, color: colors.subtextColor, opacity: 0.5, letterSpacing: 1 }}>
                        admin access
                    </Text>
                </TouchableOpacity>

            </View>
        </KeyboardAvoidingView>
    );
};


const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    inner: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        lineHeight: 36,
    },
    subtitle: {
        fontSize: 16,
        lineHeight: 22,
    },
    input: {
        fontSize: 16,
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: 1,
    },
    button: {
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 18,
    },
    switchText: {
        fontSize: 14,
        textAlign: 'center',
    },
    disclaimer: {
        fontSize: 12,
        textAlign: 'center',
    },
    roleContainer: {
        width: '100%',
    },
    roleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
    },
    roleEmoji: {
        fontSize: 32,
        marginRight: 16,
    },
    roleInfo: {
        flex: 1,
    },
    roleLabel: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    roleDesc: {
        fontSize: 14,
        opacity: 0.8,
    },
    vehicleDocContainer: {
        width: '100%',
    },
    docItem: {
        marginBottom: 12,
    },
    docInput: {
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
    },
    uploadButton: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        alignItems: 'center',
        borderStyle: 'dashed',
    },
    uploadButtonText: {
        fontSize: 14,
        fontWeight: '500',
    },
    docHint: {
        fontSize: 10,
        marginTop: 4,
        marginLeft: 4,
        opacity: 0.7,
    },
    backButton: {
        marginTop: 16,
    },
    typeButton: {
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
    },
    typeButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    spacer12: { height: 12 },
    spacer16: { height: 16 },
    spacer24: { height: 24 },
    spacer40: { height: 40 },
    sectionTitle: {
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    layoutSelector: {
        marginBottom: 20,
    },
    layoutCard: {
        width: 120,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginRight: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    layoutIcon: {
        fontSize: 24,
        marginBottom: 4,
    },
    layoutLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    adminBanner: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    adminAccessButton: {
        alignSelf: 'center',
        marginTop: 8,
        padding: 8,
    },
    consentContainer: {
        flex: 1,
        width: '100%',
    },
    consentBox: {
        maxHeight: 300,
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    },
    consentTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 12,
        textAlign: 'center',
    },
    consentIntro: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 12,
    },
    consentPoint: {
        marginBottom: 10,
    },
    consentPointText: {
        fontSize: 12,
        lineHeight: 18,
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxLabel: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
    },
});

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
    progressRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 24,
        position: 'relative',
    },
    progressDot: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    progressLabel: {
        fontSize: 10,
        fontWeight: '600',
        textAlign: 'center',
    },
    progressLine: {
        position: 'absolute',
        top: 14,
        width: '33%',
        height: 2,
        opacity: 0.4,
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

export default LoginScreen;

