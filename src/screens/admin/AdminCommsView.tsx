import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

const TEMPLATES = [
    {
        title: 'Booking Confirmation',
        body: '"Hi {passengerName}, your booking is confirmed! We\'ll contact you shortly to confirm."',
    },
    {
        title: 'Driver Assigned',
        body: '"Hi {passengerName}, your ride for {date} at {time} is confirmed! Driver: {driverName} ({driverPhone}). Vehicle: {vehicleNumber}."',
    },
    {
        title: 'Ride Reminder',
        body: '"Don\'t forget! Your GoRaahi ride departs in 1 hour from {pickup}. Please be ready."',
    },
    {
        title: 'Ride Completed',
        body: '"Thank you for riding with GoRaahi! We hope you had a great journey from {pickup} to {dropoff}. Rate your driver!"',
    },
    {
        title: 'Cancellation Notice',
        body: '"We\'re sorry! Your ride scheduled for {date} has been cancelled. Please re-book or contact support."',
    },
];

export default function AdminCommsView() {
    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionLabel}>COMMUNICATIONS</Text>
            <Text style={styles.pageTitle}>Message Templates</Text>
            {TEMPLATES.map((tpl, i) => (
                <View key={i} style={styles.card}>
                    <Text style={styles.cardTitle}>{tpl.title}</Text>
                    <View style={styles.templateBox}>
                        <Text style={styles.templateText}>{tpl.body}</Text>
                    </View>
                </View>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 24 },
    sectionLabel: { color: '#6B7280', fontSize: 12, letterSpacing: 2, marginBottom: 6 },
    pageTitle: { color: '#F9FAFB', fontSize: 28, fontWeight: 'bold', marginBottom: 24 },
    card: {
        backgroundColor: '#111827', borderRadius: 16, padding: 24,
        marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    cardTitle: { color: '#F9FAFB', fontSize: 18, fontWeight: 'bold', marginBottom: 14 },
    templateBox: {
        backgroundColor: '#1F2937', borderRadius: 10, padding: 16,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    templateText: { color: '#9CA3AF', fontSize: 14, lineHeight: 22, fontStyle: 'italic' },
});
