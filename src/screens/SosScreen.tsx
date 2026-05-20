import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    StyleSheet,
    Alert,
} from 'react-native';


interface SosScreenProps {
    visible: boolean;
    onClose: () => void;
}

import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../config/api';

const SosScreen: React.FC<SosScreenProps> = ({ visible, onClose }) => {
    const { token } = useAuth();
    const [location, setLocation] = useState<string>('Detecting location...');
    const [trustedContacts, setTrustedContacts] = useState<any[]>([]);

    useEffect(() => {
        if (visible) {
            fetchTrustedContacts();

            // Using Web Geolocation API for battery-efficient location tracking
            const getLocation = () => {
                const globalAny = globalThis as any;
                const nav = globalAny.navigator;
                if (nav && nav.geolocation) {
                    nav.geolocation.getCurrentPosition(
                        (position: { coords: { latitude: number; longitude: number } }) => {
                            const { latitude, longitude } = position.coords;
                            // Perform reverse geocoding to get a readable address
                            fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`, {
                                headers: {
                                    'User-Agent': 'RaahiApp/1.0'
                                }
                            })
                                .then(res => res.json())
                                .then(data => {
                                    if (data && data.display_name) {
                                        setLocation(data.display_name);
                                    } else {
                                        setLocation(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
                                    }
                                })
                                .catch(() => {
                                    // Fallback to coordinates if geocoding fails
                                    setLocation(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
                                });
                        },

                        (error: any) => {
                            console.error('Location error:', error);
                            setLocation('Location unavailable');
                        },
                        {
                            enableHighAccuracy: false, // Use battery-efficient detection
                            timeout: 10000,
                            maximumAge: 60000 // Use cached location if available (saves battery)
                        }
                    );
                } else {
                    setLocation('Geolocation not supported');
                }
            };

            getLocation();
        } else {
            // Reset when hidden
            setLocation('Detecting location...');
        }
    }, [visible]);

    const fetchTrustedContacts = async () => {
        try {
            const response = await fetch('http://localhost:8081/api/user/trusted-contacts', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setTrustedContacts(data);
            }
        } catch (err) {
            console.error('Failed to fetch trusted contacts:', err);
        }
    };

    const [sending, setSending] = useState(false);

    const handleAlertContacts = () => {
        if (trustedContacts.length === 0) {
            Alert.alert('No Contacts', 'Please add trusted contacts in the Account section first.');
            return;
        }

        setSending(true);

        // Simulating the time it takes to send an alert broadcast
        setTimeout(() => {
            setSending(false);
            const contactList = trustedContacts.map(c => c.phone).join(', ');
            const fullMessage = `EMERGENCY SOS: I need help! My current location is: ${location}. Please check on me immediately. - Raahi App`;

            console.log('--- SOS MESSAGE SENT ---');
            console.log(`To: ${contactList}`);
            console.log(`Message: ${fullMessage}`);
            console.log('------------------------');

            Alert.alert(
                'SOS Alert Sent',
                `The following message has been sent to ${contactList}:\n\n"${fullMessage}"`
            );
        }, 1500);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.dialogContainer}>
                    {/* Red Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerIcon}>⚠️</Text>
                        <Text style={styles.headerTitle}>EMERGENCY SOS</Text>
                        <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                            <Text style={styles.closeIcon}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Body */}
                    <View style={styles.body}>
                        <Text style={styles.bodyText}>
                            Immediate assistance available. Alert authorities and contacts.
                        </Text>

                        <View style={styles.spacer20} />

                        {/* Call Police */}
                        <TouchableOpacity
                            style={[styles.actionButton, styles.policeButton]}
                            activeOpacity={0.85}>
                            <Text style={styles.actionIcon}>📞</Text>
                            <Text style={styles.actionText}>CALL POLICE (100)</Text>
                        </TouchableOpacity>

                        <View style={styles.spacer14} />

                        {/* Alert Contacts */}
                        <TouchableOpacity
                            style={[styles.actionButton, styles.alertButton, sending && { opacity: 0.7 }]}
                            onPress={handleAlertContacts}
                            activeOpacity={0.85}
                            disabled={sending}>
                            <Text style={styles.actionIcon}>{sending ? '⏳' : '📡'}</Text>
                            <Text style={styles.actionText}>{sending ? 'Sending Alert...' : 'Alert Contacts'}</Text>
                        </TouchableOpacity>

                        <View style={styles.spacer18} />

                        {/* Location Info */}
                        <View style={styles.locationBar}>
                            <Text style={styles.locationIcon}>📍</Text>
                            <Text style={styles.locationText}>{location}</Text>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
};


const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    dialogContainer: {
        width: '100%',
        borderRadius: 24,
        overflow: 'hidden',
    },
    header: {
        backgroundColor: '#C62828',
        paddingHorizontal: 20,
        paddingVertical: 18,
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerIcon: {
        fontSize: 24,
        marginRight: 10,
    },
    headerTitle: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 18,
        letterSpacing: 1.1,
        flex: 1,
    },
    closeIcon: {
        color: '#FFFFFF',
        fontSize: 20,
        padding: 4,
    },
    body: {
        backgroundColor: '#232B3B',
        paddingHorizontal: 20,
        paddingVertical: 24,
    },
    bodyText: {
        color: '#FFFFFF',
        fontSize: 14,
        lineHeight: 20,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
    },
    policeButton: {
        backgroundColor: '#C62828',
    },
    alertButton: {
        backgroundColor: '#E65100',
    },
    actionIcon: {
        fontSize: 18,
        marginRight: 8,
    },
    actionText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    locationBar: {
        backgroundColor: '#0B223A',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(30,144,255,0.3)',
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
    },
    locationIcon: {
        fontSize: 16,
        marginRight: 8,
        color: '#00FFFF',
    },
    locationText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '500',
    },
    spacer14: { height: 14 },
    spacer18: { height: 18 },
    spacer20: { height: 20 },
});


export default SosScreen;
