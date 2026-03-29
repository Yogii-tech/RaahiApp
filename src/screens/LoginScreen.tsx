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
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';


const API_BASE = 'http://localhost:8081';

interface LoginScreenProps {
    onAuthenticated: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onAuthenticated }) => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [name, setName] = useState('');
    const [step, setStep] = useState<'phone' | 'otp' | 'name' | 'role' | 'vehicle'>('phone');
    const [vehicleDocs, setVehicleDocs] = useState({
        name: '',
        type: '',
        seats: '',
        number: '',
        dl: '',
        rc: '',
        pollution: '',
        image: '',
        ownership: ''
    });
    const [loading, setLoading] = useState(false);
    const { token, user, setToken, setUser } = useAuth();
    const { colors, isDark } = useTheme();
    const { t } = useLanguage();

    const [tempToken, setTempToken] = useState<string | null>(null);
    const [tempUser, setTempUser] = useState<any | null>(null);

    const handleSendOtp = async () => {
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

            setStep('otp');
            Alert.alert(t('login.otpSent'), `${t('login.testOtp')}${data.otp}`);
        } catch {
            Alert.alert(t('common.error'), t('login.connectionError'));
        } finally {
            setLoading(false);
        }
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

            if (!data.user.name) {
                setTempToken(data.token);
                setTempUser(data.user);
                setStep('name');
            } else {
                setToken(data.token);
                setUser(data.user);
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
        setStep('role');
    };

    const handleRoleSelect = (role: 'passenger' | 'driver') => {
        if (role === 'passenger') {
            handleCompleteRegistration('passenger');
        } else {
            setStep('vehicle');
        }
    };

    const handleFileUpload = (type: keyof typeof vehicleDocs) => {
        if (Platform.OS === 'web') {
            // @ts-ignore
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*,application/pdf';
            input.onchange = (e: any) => {
                const file = e.target.files[0];
                if (file) {
                    // For demo, we just store the filename
                    setVehicleDocs(prev => ({ ...prev, [type]: file.name }));
                }
            };
            input.click();
        } else {
            Alert.alert('Mobile Upload', 'Image picker would be triggered here.');
        }
    };

    const handleCompleteRegistration = async (role: 'passenger' | 'driver') => {
        const activeToken = tempToken || token;

        if (role === 'driver' && (
            !vehicleDocs.name || !vehicleDocs.type || !vehicleDocs.seats || !vehicleDocs.number ||
            !vehicleDocs.dl || !vehicleDocs.rc || !vehicleDocs.pollution || !vehicleDocs.image
        )) {
            Alert.alert(t('common.error'), t('login.uploadError'));
            return;
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
                    ownership_url: vehicleDocs.ownership
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
                setToken(activeToken);
                setUser(updatedUser);
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

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.inner}>
                <Text style={[styles.title, { color: colors.textColor }]}>
                    {step === 'name' ? t('login.enterName') :
                        step === 'role' ? t('login.chooseRole') :
                            step === 'vehicle' ? t('login.vehicleRegistration') :
                                t('login.moveFreely')}
                </Text>

                <View style={styles.spacer16} />

                <Text style={[styles.subtitle, { color: colors.subtextColor }]}>
                    {step === 'name'
                        ? t('login.helpDrivers')
                        : step === 'role'
                            ? t('login.howUseRaahi')
                            : step === 'vehicle'
                                ? ''
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
                            onPress={handleSendOtp}
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

                {step === 'vehicle' && (
                    <View style={styles.vehicleDocContainer}>
                        <TextInput
                            style={[styles.input, styles.docInput, {
                                backgroundColor: colors.inputFillColor,
                                color: colors.textColor,
                                borderColor: colors.inputBorderColor
                            }]}
                            placeholder={t('login.vehicleName')}
                            placeholderTextColor={isDark ? 'rgba(255,255,255,0.24)' : 'rgba(34,34,96,0.3)'}
                            value={vehicleDocs.name}
                            onChangeText={(text) => setVehicleDocs(prev => ({ ...prev, name: text }))}
                        />

                        <TextInput
                            style={[styles.input, styles.docInput, {
                                backgroundColor: colors.inputFillColor,
                                color: colors.textColor,
                                borderColor: colors.inputBorderColor
                            }]}
                            placeholder={t('login.vehicleTypePlaceholder')}
                            placeholderTextColor={isDark ? 'rgba(255,255,255,0.24)' : 'rgba(34,34,96,0.3)'}
                            autoCapitalize="words"
                            value={vehicleDocs.type}
                            onChangeText={(text) => setVehicleDocs(prev => ({ ...prev, type: text }))}
                        />

                        <View style={styles.row}>
                            <TextInput
                                style={[styles.input, styles.docInput, {
                                    flex: 1,
                                    backgroundColor: colors.inputFillColor,
                                    color: colors.textColor,
                                    borderColor: colors.inputBorderColor
                                }]}
                                placeholder={t('login.vehicleSeats')}
                                placeholderTextColor={isDark ? 'rgba(255,255,255,0.24)' : 'rgba(34,34,96,0.3)'}
                                keyboardType="number-pad"
                                value={vehicleDocs.seats}
                                onChangeText={(text) => setVehicleDocs(prev => ({ ...prev, seats: text.replace(/[^0-9]/g, '') }))}
                            />
                            <View style={{ width: 12 }} />
                            <TextInput
                                style={[styles.input, styles.docInput, {
                                    flex: 2,
                                    backgroundColor: colors.inputFillColor,
                                    color: colors.textColor,
                                    borderColor: colors.inputBorderColor
                                }]}
                                placeholder={t('login.vehicleNumber')}
                                placeholderTextColor={isDark ? 'rgba(255,255,255,0.24)' : 'rgba(34,34,96,0.3)'}
                                autoCapitalize="characters"
                                value={vehicleDocs.number}
                                onChangeText={(text) => setVehicleDocs(prev => ({ ...prev, number: text }))}
                            />
                        </View>

                        <View style={styles.spacer12} />
                        {[
                            { key: 'dl', label: 'login.uploadDL' },
                            { key: 'rc', label: 'login.uploadRC' },
                            { key: 'pollution', label: 'login.uploadPollution' },
                            { key: 'image', label: 'login.uploadVehicleImg', hint: 'login.vehicleImgHint' },
                            { key: 'ownership', label: 'login.uploadOwnership', hint: 'login.ownershipHint' },
                        ].map((doc) => (
                            <View key={doc.key} style={styles.docItem}>
                                <TouchableOpacity
                                    style={[styles.uploadButton, { borderColor: colors.borderColor, backgroundColor: colors.inputFillColor }]}
                                    onPress={() => handleFileUpload(doc.key as any)}>
                                    <Text style={[styles.uploadButtonText, { color: colors.textColor }]}>
                                        {(vehicleDocs as any)[doc.key] ? `✅ ${t('login.uploadSuccess')}${(vehicleDocs as any)[doc.key].substring(0, 15)}...` : t(doc.label as any)}
                                    </Text>
                                </TouchableOpacity>
                                {doc.hint && !(vehicleDocs as any)[doc.key] && (
                                    <Text style={[styles.docHint, { color: colors.subtextColor }]}>{t(doc.hint as any)}</Text>
                                )}
                            </View>
                        ))}

                        <View style={styles.spacer24} />

                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
                            onPress={() => handleCompleteRegistration('driver')}
                            activeOpacity={0.85}
                            disabled={loading}>
                            {loading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.buttonText}>{t('login.submitDocs')}</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => setStep('role')} style={styles.backButton}>
                            <Text style={[styles.switchText, { color: colors.primary }]}>{t('common.back')}</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.spacer24} />

                <Text style={[styles.disclaimer, { color: colors.subtextColor, opacity: 0.6 }]}>
                    {t('login.disclaimer')}
                </Text>
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
});

export default LoginScreen;
