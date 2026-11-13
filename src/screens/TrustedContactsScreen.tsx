import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiRequest } from '../utils/api';
import { notify } from '../utils/notify';

interface Contact {
    phone: string;
}

const TrustedContactsScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { colors, isDark } = useTheme();
    const { logout } = useAuth();
    const { t } = useLanguage();
    const [contacts, setContacts] = useState<Contact[]>([
        { phone: '' },
        { phone: '' },
    ]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        fetchContacts();
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const fetchContacts = async () => {
        if (!isMountedRef.current) return;
        setLoading(true);
        setLoadError(null);
        try {
            const response = await apiRequest('/api/user/trusted-contacts', {}, logout);
            if (!isMountedRef.current) return;
            if (response.ok) {
                const data = await response.json();
                if (!isMountedRef.current) return;
                if (data && data.length > 0) {
                    setContacts(data);
                } else {
                    setContacts([{ phone: '' }]);
                }
            } else {
                setLoadError('Failed to load trusted contacts. Please try again.');
            }
        } catch (err) {
            console.error('Failed to fetch contacts:', err);
            if (isMountedRef.current) {
                setLoadError(t('book.errorConnect') || 'Connection error. Please try again.');
            }
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    };

    const handleSave = async () => {
        if (saving) return;
        const toSave = contacts.filter(c => c.phone.trim().length > 0);

        if (toSave.length === 0) {
            notify(t('common.error'), t('trusted.atLeastOne'));
            return;
        }

        const invalidContact = toSave.find(c => c.phone.length !== 10);
        if (invalidContact) {
            notify(t('common.error'), t('trusted.tenDigits'));
            return;
        }

        setSaving(true);
        try {
            const response = await apiRequest('/api/user/trusted-contacts', {
                method: 'PUT',
                body: JSON.stringify(toSave),
            }, logout);

            if (!isMountedRef.current) return;

            if (response.ok) {
                notify(t('requests.success'), t('trusted.successUpdate'));
                onBack();
            } else {
                notify(t('common.error'), t('trusted.failUpdate'));
            }
        } catch (err) {
            if (isMountedRef.current) {
                notify(t('common.error'), t('book.errorConnect'));
            }
        } finally {
            if (isMountedRef.current) {
                setSaving(false);
            }
        }
    };

    const updateContact = (index: number, field: keyof Contact, value: string) => {
        const newContacts = [...contacts];
        newContacts[index] = { ...newContacts[index], [field]: value };
        setContacts(newContacts);
    };

    const removeContact = (index: number) => {
        const newContacts = contacts.filter((_, i) => i !== index);
        if (newContacts.length === 0) {
            newContacts.push({ phone: '' });
        }
        setContacts(newContacts);
    };

    const addContact = () => {
        if (contacts.length < 2) {
            setContacts([...contacts, { phone: '' }]);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (loadError) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Text style={[styles.backText, { color: colors.primary }]}>{t('common.back')}</Text>
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.textColor }]}>{t('trusted.title')}</Text>
                </View>
                <View style={styles.errorContainer}>
                    <Text style={[styles.errorText, { color: colors.textColor }]}>{loadError}</Text>
                    <TouchableOpacity
                        style={[styles.saveButton, { backgroundColor: colors.primary, paddingHorizontal: 28, marginTop: 16 }]}
                        onPress={fetchContacts}
                    >
                        <Text style={styles.saveButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Text style={[styles.backText, { color: colors.primary }]}>{t('common.back')}</Text>
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.textColor }]}>{t('trusted.title')}</Text>
            </View>

            <View style={styles.content}>
                <Text style={[styles.description, { color: colors.subtextColor }]}>
                    {t('trusted.description')}
                </Text>

                <View style={styles.spacer20} />

                {contacts.map((contact, index) => (
                    <View key={index} style={[styles.contactCard, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={[styles.cardLabel, { color: colors.primary }]}>{t('trusted.contactLabel')}{index + 1}</Text>
                            <TouchableOpacity onPress={() => removeContact(index)}>
                                <Text style={{ color: '#C62828', fontSize: 18 }}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.spacer12} />

                        <Text style={[styles.inputLabel, { color: colors.textColor }]}>{t('trusted.phoneLabel')}</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.inputFillColor, color: colors.textColor, borderColor: colors.inputBorderColor }]}
                            value={contact.phone}
                            onChangeText={(val) => updateContact(index, 'phone', val.replace(/[^0-9]/g, '').slice(0, 10))}
                            placeholder={t('trusted.phonePlaceholderSmall')}
                            placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                            keyboardType="phone-pad"
                            maxLength={10}
                        />
                    </View>
                ))}

                {contacts.length < 2 && (
                    <TouchableOpacity
                        style={[styles.addButton, { borderColor: colors.primary }]}
                        onPress={addContact}>
                        <Text style={[styles.addButtonText, { color: colors.primary }]}>{t('trusted.addAnother')}</Text>
                    </TouchableOpacity>
                )}


                <View style={styles.spacer24} />

                <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: colors.primary }, saving && styles.disabledButton]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>{t('trusted.saveTrusted')}</Text>}
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        paddingTop: 40,
    },
    backButton: {
        marginRight: 16,
    },
    backText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    content: {
        padding: 20,
    },
    description: {
        fontSize: 14,
        lineHeight: 20,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    errorText: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
    },
    contactCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        marginBottom: 20,
    },
    cardLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 6,
    },
    input: {
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
    },
    saveButton: {
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    disabledButton: {
        opacity: 0.7,
    },
    addButton: {
        borderWidth: 1,
        borderStyle: 'dashed',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
    },
    addButtonText: {
        fontWeight: '600',
        fontSize: 15,
    },
    spacer12: { height: 12 },
    spacer20: { height: 20 },
    spacer24: { height: 24 },
});

export default TrustedContactsScreen;
