import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Image,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiRequest } from '../utils/api';

interface Message {
    id: string;
    text: string;
    senderId: string;
    role: 'driver' | 'passenger';
    createdAt: string;
}

interface ChatScreenProps {
    bookingId: string;
    recipientName: string;
    pickup: string;
    dropoff: string;
    departureTime: string;
    seatInfo?: string;
    onBack: () => void;
}

const ChatScreen: React.FC<ChatScreenProps> = ({
    bookingId,
    recipientName,
    pickup,
    dropoff,
    departureTime,
    seatInfo,
    onBack,
}) => {
    const { colors, isDark } = useTheme();
    const { user, logout } = useAuth();
    const { t } = useLanguage();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    const fetchMessages = async () => {
        try {
            const response = await apiRequest(`/api/chat/${bookingId}`, { method: 'GET' }, logout);
            if (response.ok) {
                const data = await response.json();
                setMessages(data);
                // Mark as read
                if (data.length > 0) {
                    apiRequest(`/api/chat/${bookingId}/read`, { method: 'POST' }, logout);
                }
            }
        } catch (err) {
            console.error('Fetch messages error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const { AppState } = require('react-native');
        fetchMessages();
        const interval = setInterval(() => {
            if (AppState.currentState === 'active') {
                fetchMessages();
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [bookingId]);

    const handleSend = async (customText?: string) => {
        const textToSend = customText || inputText;
        if (!textToSend.trim()) return;

        setIsSending(true);
        try {
            const response = await apiRequest(`/api/chat/${bookingId}`, {
                method: 'POST',
                body: JSON.stringify({ text: textToSend }),
            }, logout);

            if (response.ok) {
                setInputText('');
                fetchMessages();
                // Wait a bit then scroll to bottom
                setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
            } else {
                Alert.alert('Error', 'Failed to send message');
            }
        } catch (err) {
            console.error('Send message error:', err);
        } finally {
            setIsSending(false);
        }
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isMe = item.senderId === user?.id;
        return (
            <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.theirMessageRow]}>
                {!isMe && (
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarEmoji}>👳</Text>
                    </View>
                )}
                <View style={[
                    styles.bubble,
                    isMe ?
                        { backgroundColor: colors.primary, borderBottomRightRadius: 4 } :
                        { backgroundColor: isDark ? '#2C3E50' : '#F1F3F4', borderBottomLeftRadius: 4 }
                ]}>
                    <Text style={[styles.messageText, { color: isMe ? '#FFFFFF' : colors.textColor }]}>
                        {item.text}
                    </Text>
                    <View style={styles.messageFooter}>
                        {isMe && (item as any).is_read && <Text style={styles.readCheck}>✓✓</Text>}
                        <Text style={[styles.timeText, { color: isMe ? 'rgba(255,255,255,0.7)' : colors.subtextColor }]}>
                            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    const quickReplies = [
        { label: t('chat.onMyWay'), text: t('chat.onMyWay') },
        { label: t('chat.fiveMinAway'), text: t('chat.fiveMinAway') },
        { label: t('chat.reachedPickup'), text: t('chat.reachedPickup') },
        { label: t('chat.slightDelay'), text: t('chat.slightDelay') },
    ];

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.primary }]}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Text style={styles.headerIcon}>←</Text>
                </TouchableOpacity>

                <View style={styles.headerInfo}>
                    <View style={styles.headerTitleRow}>
                        <View style={styles.headerAvatar}>
                            <Text style={{ fontSize: 20 }}>👤</Text>
                        </View>
                        <View>
                            <Text style={styles.recipientName}>{recipientName}</Text>
                            <View style={styles.routePill}>
                                <Text style={styles.routeText}>RA-{bookingId.slice(-4).toUpperCase()}</Text>
                                <Text style={styles.routeArrow}> 🛣️ {pickup} → {dropoff}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.actionCircle}><Text>📞</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.actionCircle}><Text>📍</Text></TouchableOpacity>
                </View>
            </View>

            {/* Sub-header */}
            <View style={[styles.subHeader, { backgroundColor: isDark ? '#1C2939' : '#E8F0FE', borderBottomColor: colors.borderColor }]}>
                <Text style={[styles.subHeaderText, { color: colors.primary }]}>
                    ● {user?.role === 'driver' ? `${t('chat.passenger')}: ` : `${t('chat.driver')}: `}{recipientName}  •  {seatInfo || 'Seat 2A'}  •  Dep. {departureTime}
                </Text>
            </View>

            {isLoading ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} />
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                />
            )}

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={90}>

                {/* Quick Replies */}
                <View style={styles.quickRepliesContainer}>
                    <FlatList
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        data={quickReplies}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[styles.quickReplyPill, { borderColor: colors.borderColor }]}
                                onPress={() => handleSend(item.text)}>
                                <Text style={[styles.quickReplyText, { color: colors.textColor }]}>{item.label}</Text>
                            </TouchableOpacity>
                        )}
                    />
                </View>

                {/* Input Bar */}
                <View style={[styles.inputBar, { backgroundColor: isDark ? '#1C2939' : '#FFFFFF', borderTopColor: colors.borderColor }]}>
                    <TouchableOpacity style={styles.attachmentButton}>
                        <Text style={styles.inputIcon}>📎</Text>
                    </TouchableOpacity>

                    <TextInput
                        style={[styles.input, { color: colors.textColor, backgroundColor: isDark ? '#2C3E50' : '#F1F3F4' }]}
                        placeholder={t('chat.typePlaceholder')}
                        placeholderTextColor={colors.subtextColor}
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                    />

                    <TouchableOpacity style={styles.emojiButton}>
                        <Text style={styles.inputIcon}>😊</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.sendButton, { backgroundColor: inputText.trim() ? colors.primary : '#BDC3C7' }]}
                        onPress={() => handleSend()}
                        disabled={!inputText.trim() || isSending}>
                        <Text style={styles.sendIcon}>➔</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 45,
        paddingBottom: 15,
    },
    backButton: {
        padding: 8,
        marginRight: 8,
    },
    headerIcon: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: 'bold',
    },
    headerInfo: {
        flex: 1,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    recipientName: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    routePill: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    routeText: {
        color: '#FFF',
        fontSize: 11,
        opacity: 0.9,
    },
    routeArrow: {
        color: '#FFF',
        fontSize: 11,
        opacity: 0.9,
    },
    headerActions: {
        flexDirection: 'row',
    },
    actionCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    subHeader: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    subHeaderText: {
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
    listContent: {
        padding: 16,
        paddingBottom: 32,
    },
    messageRow: {
        flexDirection: 'row',
        marginBottom: 20,
        maxWidth: '80%',
    },
    myMessageRow: {
        alignSelf: 'flex-end',
    },
    theirMessageRow: {
        alignSelf: 'flex-start',
    },
    avatarPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F3F4',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
        marginTop: 8,
    },
    avatarEmoji: {
        fontSize: 18,
    },
    bubble: {
        padding: 12,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    messageText: {
        fontSize: 15,
        lineHeight: 20,
    },
    messageFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 4,
    },
    timeText: {
        fontSize: 10,
    },
    readCheck: {
        fontSize: 10,
        color: '#D1E3FF',
        marginRight: 4,
        fontWeight: 'bold',
    },
    quickRepliesContainer: {
        paddingVertical: 12,
        paddingLeft: 16,
    },
    quickReplyPill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        marginRight: 10,
    },
    quickReplyText: {
        fontSize: 13,
        fontWeight: '500',
    },
    inputBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderTopWidth: 1,
    },
    attachmentButton: {
        padding: 8,
    },
    emojiButton: {
        position: 'absolute',
        right: 75,
        padding: 8,
    },
    inputIcon: {
        fontSize: 20,
    },
    input: {
        flex: 1,
        borderRadius: 25,
        paddingHorizontal: 16,
        paddingVertical: 8,
        paddingRight: 40,
        fontSize: 15,
        maxHeight: 100,
        marginHorizontal: 8,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendIcon: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
    },
});

export default ChatScreen;
