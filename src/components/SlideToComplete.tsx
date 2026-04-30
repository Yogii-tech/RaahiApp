import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder, Dimensions } from 'react-native';

const SLIDER_WIDTH = Dimensions.get('window').width > 400 ? 320 : 280;
const SLIDER_HEIGHT = 50;
const THUMB_SIZE = 40;

interface SlideToCompleteProps {
    onComplete: () => void;
    title?: string;
}

const SlideToComplete: React.FC<SlideToCompleteProps> = ({ onComplete, title = "SLIDE TO COMPLETE" }) => {
    const pan = useRef(new Animated.ValueXY()).current;
    const [triggered, setTriggered] = useState(false);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => !triggered,
            onMoveShouldSetPanResponder: () => !triggered,
            onPanResponderMove: (e, gesture) => {
                const maxX = SLIDER_WIDTH - THUMB_SIZE - 10;
                if (gesture.dx > 0 && gesture.dx < maxX) {
                    pan.setValue({ x: gesture.dx, y: 0 });
                } else if (gesture.dx >= maxX) {
                    pan.setValue({ x: maxX, y: 0 });
                }
            },
            onPanResponderRelease: (e, gesture) => {
                const maxX = SLIDER_WIDTH - THUMB_SIZE - 10;
                if (gesture.dx >= maxX * 0.75) {
                    // Triggered
                    setTriggered(true);
                    Animated.timing(pan, {
                        toValue: { x: maxX, y: 0 },
                        duration: 150,
                        useNativeDriver: false,
                    }).start(() => {
                        onComplete();
                    });
                } else {
                    // Snap back
                    Animated.spring(pan, {
                        toValue: { x: 0, y: 0 },
                        useNativeDriver: false,
                    }).start();
                }
            },
        })
    ).current;

    return (
        <View style={styles.container}>
            <View style={[styles.track, triggered && styles.trackCompleted]}>
                <Text style={styles.text}>{triggered ? "COMPLETED ✓" : title}</Text>
                
                <Animated.View
                    style={[styles.thumb, { transform: [{ translateX: pan.x }] }, triggered && styles.thumbCompleted]}
                    {...panResponder.panHandlers}
                >
                    <Text style={styles.thumbArrow}>{triggered ? "✓" : ">>"}</Text>
                </Animated.View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        marginVertical: 15,
        width: '100%',
    },
    track: {
        width: SLIDER_WIDTH,
        height: SLIDER_HEIGHT,
        backgroundColor: '#2A3441',
        borderRadius: SLIDER_HEIGHT / 2,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
    },
    trackCompleted: {
        backgroundColor: '#1E2B1F', // Dark green background indicating complete
        borderWidth: 1,
        borderColor: '#4CAF50'
    },
    text: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
        letterSpacing: 2,
        opacity: 0.8,
    },
    thumb: {
        position: 'absolute',
        left: 5,
        top: 5,
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        backgroundColor: '#4285F4',
        borderRadius: THUMB_SIZE / 2,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        cursor: 'pointer' as any, // Adding explicit any cast if typescript complains about pointer
    },
    thumbCompleted: {
        backgroundColor: '#4CAF50',
    },
    thumbArrow: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 16,
    }
});

export default SlideToComplete;
