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
    Linking,
    BackHandler,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiRequest } from '../utils/api';
import { parseJsonSafe, getApiErrorMessage, createRequestAbort } from '../utils/json';
import { notify, confirmAction } from '../utils/notify';
import { useVisibilityPolling } from '../utils/polling';
import { useRoute, useNavigation } from '@react-navigation/native';
import BackButton from '../components/BackButton';

export const CHAT_POLL_ACTIVE_MS = 4000;
export const CHAT_POLL_WARM_MS = 8000;
export const CHAT_POLL_IDLE_MS = 15000;

export function getNextChatPollIntervalMs(unchangedPolls: number): number {
    if (unchangedPolls >= 3) return CHAT_POLL_IDLE_MS;
    if (unchangedPolls >= 1) return CHAT_POLL_WARM_MS;
    return CHAT_POLL_ACTIVE_MS;
}

export function getChatMessagesSignature(list: { id?: string; _id?: string; createdAt?: string; text?: string }[]): string {
    if (!Array.isArray(list) || list.length === 0) return '0';
    const last = list[list.length - 1];
    const lastId = last?.id || last?._id || '';
    return `${list.length}:${lastId}:${last?.createdAt || ''}:${last?.text || ''}`;
}

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
    recipientPhone?: string;
    pickup: string;
    dropoff: string;
    departureTime: string;
    pickupLat?: number;
    pickupLng?: number;
    dropoffLat?: number;
    dropoffLng?: number;
    seatInfo?: string;
    onBack: () => void;
}

const ChatScreen: React.FC<ChatScreenProps> = ({
    bookingId,
    recipientName,
    recipientPhone,
    pickup,
    dropoff,
    departureTime,
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    seatInfo,
    onBack,
}) => {
    const { colors, isDark } = useTheme();
    const { user, logout } = useAuth();
    const { t } = useLanguage();
    const navigation = useNavigation<any>();

    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const lastMarkedReadRef = useRef<string>('');
    const sendingRef = useRef(false);
    const fetchSeqRef = useRef(0);
    const abortRef = useRef<AbortController | null>(null);
    const isMountedRef = useRef(true);
    const lastSignatureRef = useRef<string>('');
    const unchangedPollsRef = useRef(0);
    const pollIntervalRef = useRef<number>(CHAT_POLL_ACTIVE_MS);
    const prevMessageCountRef = useRef(0);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            abortRef.current?.abort();
        };
    }, []);

    useEffect(() => {
        const prevCount = prevMessageCountRef.current;
        prevMessageCountRef.current = messages.length;
        if (messages.length > prevCount && messages.length > 0) {
            const timer = setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: prevCount > 0 });
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [messages.length]);

    const myUserId = user?.id || (user as any)?._id;

    const fetchMessages = async () => {
        const targetBookingId = bookingId;
        if (!targetBookingId) {
            setIsLoading(false);
            return;
        }
        abortRef.current?.abort();
        const abort = createRequestAbort(10000);
        abortRef.current = abort.controller;
        const seq = ++fetchSeqRef.current;

        try {
            const response = await apiRequest(
                `/api/chat/${targetBookingId}`,
                { method: 'GET', signal: abort.signal },
                logout
            );
            if (!isMountedRef.current || seq !== fetchSeqRef.current || abort.signal.aborted) return;
            if (response.ok) {
                const data = await parseJsonSafe(response);
                if (!isMountedRef.current || seq !== fetchSeqRef.current || abort.signal.aborted) return;
                const safeMessages: Message[] = Array.isArray(data) ? data : [];
                const nextSignature = getChatMessagesSignature(safeMessages);

                if (nextSignature !== lastSignatureRef.current) {
                    lastSignatureRef.current = nextSignature;
                    unchangedPollsRef.current = 0;
                    pollIntervalRef.current = CHAT_POLL_ACTIVE_MS;
                    setMessages(safeMessages);
                } else {
                    unchangedPollsRef.current += 1;
                    pollIntervalRef.current = getNextChatPollIntervalMs(unchangedPollsRef.current);
                }
                setError(null);
                // Mark as read only when new incoming messages arrive
                const incoming = safeMessages.filter(m => !myUserId || m.senderId !== myUserId);
                const latestIncoming = incoming[incoming.length - 1];
                const latestIncomingId = latestIncoming
                    ? (latestIncoming.id || (latestIncoming as any)._id || latestIncoming.createdAt || String(incoming.length))
                    : '';
                const readMarker = latestIncoming ? `${incoming.length}:${latestIncomingId}` : '';
                if (readMarker && readMarker !== lastMarkedReadRef.current) {
                    lastMarkedReadRef.current = readMarker;
                    apiRequest(`/api/chat/${targetBookingId}/read`, { method: 'POST' }, logout)
                        .then(res => {
                            if (!res.ok && lastMarkedReadRef.current === readMarker) {
                                lastMarkedReadRef.current = '';
                            }
                        })
                        .catch(() => {
                            if (lastMarkedReadRef.current === readMarker) {
                                lastMarkedReadRef.current = '';
                            }
                        });
                }
            } else {
                const errData = await parseJsonSafe(response);
                if (isMountedRef.current && seq === fetchSeqRef.current) {
                    setError(getApiErrorMessage(errData, 'Failed to load messages.', response));
                }
            }
        } catch (err: any) {
            if (err?.name === 'AbortError' || abort.signal.aborted) {
                if (abort.didTimeout() && isMountedRef.current && seq === fetchSeqRef.current) {
                    setError('Connection timed out while loading messages.');
                }
                return;
            }
            console.error('Fetch messages error:', err);
            if (isMountedRef.current && seq === fetchSeqRef.current) {
                setError('Could not load messages. Please check your connection.');
            }
        } finally {
            abort.cleanup();
            if (isMountedRef.current && seq === fetchSeqRef.current && (!abort.signal.aborted || abort.didTimeout())) {
                setIsLoading(false);
            }
        }
    };

    const fetchMessagesRef = useRef(fetchMessages);
    fetchMessagesRef.current = fetchMessages;

    const { triggerSync } = useVisibilityPolling({
        enabled: Boolean(bookingId),
        intervalMs: () => pollIntervalRef.current,
        onPoll: () => fetchMessagesRef.current(),
        onPause: () => abortRef.current?.abort(),
    });

    const prevChatKeyRef = useRef(`${bookingId}:${myUserId || ''}`);
    useEffect(() => {
        const nextKey = `${bookingId}:${myUserId || ''}`;
        if (prevChatKeyRef.current !== nextKey) {
            prevChatKeyRef.current = nextKey;
            abortRef.current?.abort();
            lastMarkedReadRef.current = '';
            lastSignatureRef.current = '';
            unchangedPollsRef.current = 0;
            pollIntervalRef.current = CHAT_POLL_ACTIVE_MS;
            prevMessageCountRef.current = 0;
            setMessages([]);
            setError(null);
            setIsLoading(true);
            if (bookingId) {
                void triggerSync();
            }
        }
    }, [bookingId, myUserId, triggerSync]);

    useEffect(() => {
        const handleHardwareBack = () => {
            onBack();
            return true;
        };
        const subscription = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);
        return () => subscription.remove();
    }, [onBack]);

    const handleSend = async (customText?: string) => {
        if (isSending || sendingRef.current) return;
        const textToSend = customText ?? inputText;
        if (!textToSend.trim()) return;

        sendingRef.current = true;
        setIsSending(true);
        try {
            const response = await apiRequest(`/api/chat/${bookingId}`, {
                method: 'POST',
                body: JSON.stringify({ text: textToSend }),
            }, logout);

            if (response.ok) {
                if (isMountedRef.current && !customText) {
                    setInputText('');
                }
                unchangedPollsRef.current = 0;
                pollIntervalRef.current = CHAT_POLL_ACTIVE_MS;
                void triggerSync();
            } else {
                const errData = await parseJsonSafe(response);
                notify('Error', getApiErrorMessage(errData, 'Failed to send message', response));
            }
        } catch (err) {
            console.error('Send message error:', err);
            notify('Error', 'Failed to send message');
        } finally {
            sendingRef.current = false;
            if (isMountedRef.current) {
                setIsSending(false);
            }
        }
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isMe = item.senderId === user?.id || item.senderId === (user as any)?._id;
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
                        {isMe && <Text style={styles.readCheck}>✓✓</Text>}
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
                <BackButton
                    onPress={onBack}
                    variant="icon"
                    tone="inverted"
                    style={styles.backButton}
                />

                <View style={styles.headerInfo}>
                    <View style={styles.headerTitleRow}>
                        <View style={styles.headerAvatar}>
                            <Text style={{ fontSize: 20 }}>👤</Text>
                        </View>
                        <View>
                            <Text style={styles.recipientName}>{recipientName}</Text>
                            <View style={styles.routePill}>
                                <Text style={styles.routeText}>RA-{(bookingId || '').slice(-4).toUpperCase()}</Text>
                                <Text style={styles.routeArrow}> 🛣️ {pickup} → {dropoff}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.actionCircle}
                        onPress={() => {
                            const safePhone = (recipientPhone || '').replace(/[^0-9+]/g, '');
                            if (!safePhone) {
                                notify('Phone Unavailable', 'The phone number for this user is not available.');
                                return;
                            }
                            if (Platform.OS === 'web') {
                                confirmAction('Call', `Call ${recipientName} at ${safePhone}?`, () => {
                                    window.open(`tel:${safePhone}`, '_self');
                                }, 'Call');
                            } else {
                                Linking.openURL(`tel:${safePhone}`).catch(() => {
                                    notify('Error', 'Could not open phone dialer. Number: ' + safePhone);
                                });
                            }
                        }}
                    >
                        <Text>📞</Text>
                    </TouchableOpacity>
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
            ) : error && messages.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                    <Text style={{ color: '#F44336', fontSize: 15, textAlign: 'center', marginBottom: 12 }}>
                        {error}
                    </Text>
                    <TouchableOpacity
                        onPress={() => {
                            setIsLoading(true);
                            fetchMessagesRef.current();
                        }}
                        style={{ backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 }}
                    >
                        <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    {error ? (
                        <TouchableOpacity
                            onPress={() => fetchMessagesRef.current()}
                            style={{ backgroundColor: 'rgba(244, 67, 54, 0.12)', paddingHorizontal: 14, paddingVertical: 8 }}
                        >
                            <Text style={{ color: '#F44336', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
                                ⚠️ {error} Tap to retry.
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        renderItem={renderMessage}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                    />
                </View>
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
                                style={[styles.quickReplyPill, { borderColor: colors.borderColor }, isSending && { opacity: 0.5 }]}
                                disabled={isSending}
                                onPress={() => handleSend(item.text)}>
                                <Text style={[styles.quickReplyText, { color: colors.textColor }]}>{item.label}</Text>
                            </TouchableOpacity>
                        )}
                    />
                </View>

                {/* Input Bar */}
                <View style={[styles.inputBar, { backgroundColor: isDark ? '#1C2939' : '#FFFFFF', borderTopColor: colors.borderColor }]}>

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
        marginRight: 10,
        zIndex: 50,
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
