import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator,
    ScrollView, TouchableOpacity, Modal, Image, TextInput, Alert, Platform
} from 'react-native';
import { API_BASE } from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';
import { downloadCSV } from '../../utils/exportUtils';

export interface Driver {
    id: string;
    name: string;
    phone: string;
    location?: string;
    verificationStatus?: 'pending' | 'verified' | 'rejected' | string;
    rejectionReason?: string;
    submittedAt?: string;
    vehicleName?: string;
    vehicleNumber?: string;
    vehicleType?: string;
    seats?: number;
    seatingLayout?: string;
    dlUrl?: string;
    rcUrl?: string;
    pollutionUrl?: string;
    vehicleImageUrl?: string;
    ownershipUrl?: string;
    totalRides?: number;
}

export default function AdminDriversView({ token, searchQuery = '', initialFilter = 'all' }: { token: string; searchQuery?: string; initialFilter?: 'all' | 'pending' | 'verified' | 'rejected' }) {
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
    const [inspectModalVisible, setInspectModalVisible] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [submittingAction, setSubmittingAction] = useState(false);
    const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>(initialFilter);

    const { fetchWithAuth } = useAuth();

    useEffect(() => {
        loadDrivers();
    }, []);

    const loadDrivers = async () => {
        setLoading(true);
        try {
            const res = await fetchWithAuth(`${API_BASE}/api/admin/drivers`);
            const d = await res.json();
            setDrivers(Array.isArray(d) ? d : []);
        } catch (err) {
            console.error('Failed to load drivers:', err);
            setDrivers([]);
        } finally {
            setLoading(false);
        }
    };

    const handleInspect = (driver: Driver) => {
        setSelectedDriver(driver);
        setRejectionReason(driver.rejectionReason || '');
        setInspectModalVisible(true);
    };

    const handleVerifyAction = async (status: 'verified' | 'rejected') => {
        if (!selectedDriver) return;
        if (status === 'rejected' && !rejectionReason.trim()) {
            const msg = 'Please enter a rejection reason (e.g. RC document photo is unclear).';
            if (Platform.OS === 'web') alert(msg);
            else Alert.alert('Reason Required', msg);
            return;
        }

        setSubmittingAction(true);
        try {
            const res = await fetchWithAuth(`${API_BASE}/api/admin/drivers/${selectedDriver.id}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status,
                    reason: status === 'rejected' ? rejectionReason.trim() : ''
                })
            });

            if (res.ok) {
                const msg = `Driver ${selectedDriver.name} marked as ${status.toUpperCase()}`;
                if (Platform.OS === 'web') alert(msg);
                else Alert.alert('Success', msg);

                setInspectModalVisible(false);
                setSelectedDriver(null);
                loadDrivers();
            } else {
                const data = await res.json();
                const msg = data.error || 'Failed to update verification status';
                if (Platform.OS === 'web') alert(msg);
                else Alert.alert('Error', msg);
            }
        } catch (err) {
            const msg = 'Connection error while updating status';
            if (Platform.OS === 'web') alert(msg);
            else Alert.alert('Error', msg);
        } finally {
            setSubmittingAction(false);
        }
    };

    const pendingCount = drivers.filter(d => (d.verificationStatus || 'pending') === 'pending').length;
    const verifiedCount = drivers.filter(d => d.verificationStatus === 'verified').length;
    const rejectedCount = drivers.filter(d => d.verificationStatus === 'rejected').length;

    const filteredDrivers = drivers.filter(d => {
        const matchesSearch =
            d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.vehicleNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.location?.toLowerCase().includes(searchQuery.toLowerCase());

        const status = d.verificationStatus || 'pending';
        if (activeFilter === 'pending') return matchesSearch && status === 'pending';
        if (activeFilter === 'verified') return matchesSearch && status === 'verified';
        if (activeFilter === 'rejected') return matchesSearch && status === 'rejected';
        return matchesSearch;
    });

    const getFullUrl = (url?: string) => {
        if (!url) return '';
        return url.startsWith('http') ? url : `${API_BASE}${url}`;
    };

    if (loading) return <ActivityIndicator color="#3B7DDD" size="large" style={{ marginTop: 60 }} />;

    return (
        <View style={styles.container}>
            {/* Header Section */}
            <View style={styles.headerArea}>
                <View>
                    <Text style={styles.pageTitle}>Driver Onboarding & Verification</Text>
                    <Text style={styles.pageSubtitle}>
                        Drivers must pass 100% document review before receiving ride-posting privileges.
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.exportBtn}
                    onPress={() => downloadCSV(drivers, 'Driver_Onboarding_Report')}
                >
                    <Text style={styles.exportBtnText}>Export CSV</Text>
                </TouchableOpacity>
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterRow}>
                {[
                    { id: 'all', label: `All (${drivers.length})` },
                    { id: 'pending', label: `Pending Review (${pendingCount})`, badge: pendingCount },
                    { id: 'verified', label: `Verified (${verifiedCount})` },
                    { id: 'rejected', label: `Rejected (${rejectedCount})` },
                ].map(tab => (
                    <TouchableOpacity
                        key={tab.id}
                        style={[
                            styles.filterTab,
                            activeFilter === tab.id && styles.filterTabActive
                        ]}
                        onPress={() => setActiveFilter(tab.id as any)}
                    >
                        <Text style={[
                            styles.filterTabText,
                            activeFilter === tab.id && styles.filterTabTextActive
                        ]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Table Container */}
            <View style={styles.tableCard}>
                <View style={styles.tableCardHeader}>
                    <Text style={styles.tableCardTitle}>DRIVER ONBOARDING QUEUE</Text>
                    <Text style={styles.tableCardCount}>{filteredDrivers.length} Records</Text>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: '100%' }}>
                    <View style={{ minWidth: 1150, flex: 1 }}>
                        {/* Table Header */}
                        <View style={styles.tableHeader}>
                            <Text style={[styles.headerCell, { flex: 2 }]}>DRIVER NAME & PHONE</Text>
                            <Text style={[styles.headerCell, { flex: 1.2 }]}>LOCATION</Text>
                            <Text style={[styles.headerCell, { flex: 1.8 }]}>VEHICLE DETAILS</Text>
                            <Text style={[styles.headerCell, { flex: 2.5 }]}>DOCUMENTS STATUS</Text>
                            <Text style={[styles.headerCell, { flex: 1.5 }]}>SUBMITTED</Text>
                            <Text style={[styles.headerCell, { flex: 1.5 }]}>VERIFICATION STATUS</Text>
                            <Text style={[styles.headerCell, { flex: 1.5, textAlign: 'center' }]}>ACTIONS</Text>
                        </View>

                        {/* Table Body */}
                        <FlatList
                            data={filteredDrivers}
                            keyExtractor={item => item.id}
                            renderItem={({ item, index }) => {
                                const status = item.verificationStatus || 'pending';
                                const hasDL = !!item.dlUrl;
                                const hasRC = !!item.rcUrl;
                                const hasPollution = !!item.pollutionUrl;
                                const hasPhoto = !!item.vehicleImageUrl;
                                const hasOwnership = !!item.ownershipUrl;

                                return (
                                    <View style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}>
                                        {/* Driver Name & Phone */}
                                        <View style={{ flex: 2, justifyContent: 'center' }}>
                                            <Text style={styles.driverName}>{item.name || 'Unknown Driver'}</Text>
                                            <Text style={styles.driverPhone}>{item.phone || 'No phone'}</Text>
                                        </View>

                                        {/* Location */}
                                        <View style={{ flex: 1.2, justifyContent: 'center' }}>
                                            <Text style={styles.locationText}>{item.location || 'Uttarakhand'}</Text>
                                        </View>

                                        {/* Vehicle Details */}
                                        <View style={{ flex: 1.8, justifyContent: 'center' }}>
                                            <Text style={styles.vehicleName}>{item.vehicleName || item.vehicleType || 'Vehicle'}</Text>
                                            <Text style={styles.vehicleNumber}>{item.vehicleNumber || '—'}</Text>
                                        </View>

                                        {/* Documents Badges */}
                                        <View style={{ flex: 2.5, flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                            <DocBadge label="Driving Licence" isUploaded={hasDL} />
                                            <DocBadge label="Vehicle RC" isUploaded={hasRC} />
                                            <DocBadge label="Pollution Cert" isUploaded={hasPollution} />
                                            <DocBadge label="Vehicle Photo" isUploaded={hasPhoto} />
                                            {hasOwnership && <DocBadge label="Ownership Proof" isUploaded={true} />}
                                        </View>

                                        {/* Submitted Date */}
                                        <View style={{ flex: 1.5, justifyContent: 'center' }}>
                                            <Text style={styles.submittedText}>{item.submittedAt || 'Recent'}</Text>
                                        </View>

                                        {/* Verification Status Badge */}
                                        <View style={{ flex: 1.5, justifyContent: 'center' }}>
                                            <View style={[
                                                styles.statusBadge,
                                                status === 'verified' && styles.statusBadgeVerified,
                                                status === 'rejected' && styles.statusBadgeRejected,
                                                status === 'pending' && styles.statusBadgePending,
                                            ]}>
                                                <Text style={[
                                                    styles.statusBadgeText,
                                                    status === 'verified' && { color: '#22C55E' },
                                                    status === 'rejected' && { color: '#EF4444' },
                                                    status === 'pending' && { color: '#F59E0B' },
                                                ]}>
                                                    {status.toUpperCase()}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Actions */}
                                        <View style={{ flex: 1.5, alignItems: 'center', justifyContent: 'center' }}>
                                            <TouchableOpacity
                                                style={styles.inspectBtn}
                                                onPress={() => handleInspect(item)}
                                                activeOpacity={0.8}
                                            >
                                                <Text style={{ fontSize: 13, marginRight: 4 }}>👁</Text>
                                                <Text style={styles.inspectBtnText}>Inspect Docs</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            }}
                            ListEmptyComponent={
                                <View style={styles.emptyBox}>
                                    <Text style={styles.emptyText}>No driver onboardings found in this view.</Text>
                                </View>
                            }
                        />
                    </View>
                </ScrollView>
            </View>

            {/* Document Inspection Modal */}
            {inspectModalVisible && selectedDriver && (
                <Modal
                    visible={inspectModalVisible}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setInspectModalVisible(false)}
                >
                    <View style={styles.modalBackdrop}>
                        <View style={styles.inspectModalCard}>
                            {/* Modal Header */}
                            <View style={styles.modalHeader}>
                                <View>
                                    <Text style={styles.modalTitle}>Inspect Driver Documents</Text>
                                    <Text style={styles.modalSub}>{selectedDriver.name} ({selectedDriver.phone})</Text>
                                </View>
                                <TouchableOpacity onPress={() => setInspectModalVisible(false)} style={styles.closeBtn}>
                                    <Text style={{ color: '#9CA3AF', fontSize: 20, fontWeight: 'bold' }}>✕</Text>
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={{ flex: 1, padding: 20 }} showsVerticalScrollIndicator={false}>
                                {/* Driver & Vehicle Details Header Card */}
                                <View style={styles.summaryCard}>
                                    <View style={styles.summaryCol}>
                                        <Text style={styles.summaryLabel}>DRIVER NAME</Text>
                                        <Text style={styles.summaryVal}>{selectedDriver.name}</Text>
                                    </View>
                                    <View style={styles.summaryCol}>
                                        <Text style={styles.summaryLabel}>PHONE</Text>
                                        <Text style={styles.summaryVal}>{selectedDriver.phone}</Text>
                                    </View>
                                    <View style={styles.summaryCol}>
                                        <Text style={styles.summaryLabel}>VEHICLE</Text>
                                        <Text style={styles.summaryVal}>{selectedDriver.vehicleName || '—'} ({selectedDriver.vehicleNumber || '—'})</Text>
                                    </View>
                                    <View style={styles.summaryCol}>
                                        <Text style={styles.summaryLabel}>LAYOUT</Text>
                                        <Text style={styles.summaryVal}>{(selectedDriver.seatingLayout || 'SUV').toUpperCase()}</Text>
                                    </View>
                                </View>

                                {/* Document Cards List */}
                                <Text style={styles.sectionHeader}>SUBMITTED KYC DOCUMENTS</Text>

                                <DocInspectCard
                                    title="1. Driving License (DL)"
                                    url={getFullUrl(selectedDriver.dlUrl)}
                                    onPreview={() => setPreviewImage(getFullUrl(selectedDriver.dlUrl))}
                                />
                                <DocInspectCard
                                    title="2. RC Book (Registration Certificate)"
                                    url={getFullUrl(selectedDriver.rcUrl)}
                                    onPreview={() => setPreviewImage(getFullUrl(selectedDriver.rcUrl))}
                                />
                                <DocInspectCard
                                    title="3. Pollution Certificate (PUC)"
                                    url={getFullUrl(selectedDriver.pollutionUrl)}
                                    onPreview={() => setPreviewImage(getFullUrl(selectedDriver.pollutionUrl))}
                                />
                                <DocInspectCard
                                    title="4. Vehicle Photo (Number Plate Visible)"
                                    url={getFullUrl(selectedDriver.vehicleImageUrl)}
                                    onPreview={() => setPreviewImage(getFullUrl(selectedDriver.vehicleImageUrl))}
                                />
                                {selectedDriver.ownershipUrl ? (
                                    <DocInspectCard
                                        title="5. Ownership Proof"
                                        url={getFullUrl(selectedDriver.ownershipUrl)}
                                        onPreview={() => setPreviewImage(getFullUrl(selectedDriver.ownershipUrl))}
                                    />
                                ) : null}

                                {/* Rejection Reason Input */}
                                <View style={styles.reasonSection}>
                                    <Text style={styles.reasonLabel}>REJECTION REASON / FEEDBACK (IF REJECTING)</Text>
                                    <TextInput
                                        style={styles.reasonInput}
                                        placeholder="Specify why documents are rejected (e.g., Driving License image is blurry, RC certificate expired)..."
                                        placeholderTextColor="#6B7280"
                                        multiline={true}
                                        numberOfLines={3}
                                        value={rejectionReason}
                                        onChangeText={setRejectionReason}
                                    />
                                </View>
                            </ScrollView>

                            {/* Modal Action Buttons */}
                            <View style={styles.modalFooter}>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.rejectBtn, submittingAction && { opacity: 0.6 }]}
                                    onPress={() => handleVerifyAction('rejected')}
                                    disabled={submittingAction}
                                >
                                    <Text style={styles.actionBtnText}>✕ Reject Onboarding</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.approveBtn, submittingAction && { opacity: 0.6 }]}
                                    onPress={() => handleVerifyAction('verified')}
                                    disabled={submittingAction}
                                >

                                    {submittingAction ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.actionBtnText}>✓ Approve & Verify Driver</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {/* Image Preview Sub-Modal */}
            {previewImage && (
                <Modal visible={!!previewImage} transparent={true} animationType="fade" onRequestClose={() => setPreviewImage(null)}>
                    <View style={styles.previewBackdrop}>
                        <View style={styles.previewCard}>
                            <View style={styles.previewHeader}>
                                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Document Preview</Text>
                                <TouchableOpacity onPress={() => setPreviewImage(null)}>
                                    <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold' }}>✕</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.previewImgBox}>
                                <Image source={{ uri: previewImage }} style={styles.fullImage} resizeMode="contain" />
                            </View>
                        </View>
                    </View>
                </Modal>
            )}
        </View>
    );
}

const DocBadge = ({ label, isUploaded }: { label: string; isUploaded: boolean }) => (
    <View style={[
        styles.docBadge,
        isUploaded ? styles.docBadgeSuccess : styles.docBadgeWarning
    ]}>
        <Text style={[
            styles.docBadgeText,
            isUploaded ? { color: '#22C55E' } : { color: '#F59E0B' }
        ]}>
            {isUploaded ? `✓ ${label}` : `! ${label}`}
        </Text>
    </View>
);

const DocInspectCard = ({ title, url, onPreview }: { title: string; url: string; onPreview: () => void }) => (
    <View style={styles.docInspectCard}>
        <View style={{ flex: 1 }}>
            <Text style={styles.docInspectTitle}>{title}</Text>
            <Text style={styles.docInspectStatus}>
                {url ? '✓ Document uploaded' : '⚠ Missing document'}
            </Text>
        </View>
        {url ? (
            <TouchableOpacity style={styles.viewDocBtn} onPress={onPreview}>
                <Text style={styles.viewDocBtnText}>View Image 👁</Text>
            </TouchableOpacity>
        ) : (
            <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: 'bold' }}>Not Provided</Text>
        )}
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, padding: 24 },
    headerArea: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    pageTitle: { color: '#F9FAFB', fontSize: 26, fontWeight: 'bold', marginBottom: 4 },
    pageSubtitle: { color: '#9CA3AF', fontSize: 14 },
    exportBtn: { backgroundColor: '#3B7DDD', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
    exportBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
    filterRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    filterTab: {
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
        backgroundColor: '#1F2937', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)'
    },
    filterTabActive: { backgroundColor: '#3B7DDD', borderColor: '#3B7DDD' },
    filterTabText: { color: '#9CA3AF', fontSize: 13, fontWeight: '600' },
    filterTabTextActive: { color: '#FFFFFF', fontWeight: 'bold' },
    tableCard: {
        flex: 1, backgroundColor: '#111827', borderRadius: 16,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
    },
    tableCardHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#1F2937',
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)'
    },
    tableCardTitle: { color: '#F9FAFB', fontSize: 13, fontWeight: 'bold', letterSpacing: 1 },
    tableCardCount: { color: '#3B7DDD', fontSize: 12, fontWeight: 'bold' },
    tableHeader: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
        backgroundColor: '#0D1117',
    },
    headerCell: { color: '#6B7280', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
    tableRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 16,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
    },
    tableRowAlt: { backgroundColor: 'rgba(255,255,255,0.015)' },
    driverName: { color: '#F9FAFB', fontSize: 14, fontWeight: 'bold' },
    driverPhone: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
    locationText: { color: '#D1D5DB', fontSize: 13 },
    vehicleName: { color: '#F9FAFB', fontSize: 13, fontWeight: '600' },
    vehicleNumber: { color: '#3B7DDD', fontSize: 11, fontWeight: 'bold', marginTop: 2 },
    docBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
    docBadgeSuccess: { backgroundColor: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.3)' },
    docBadgeWarning: { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)' },
    docBadgeText: { fontSize: 11, fontWeight: 'bold' },
    submittedText: { color: '#9CA3AF', fontSize: 12 },
    statusBadge: {
        paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
        alignSelf: 'flex-start', borderWidth: 1
    },
    statusBadgePending: { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.4)' },
    statusBadgeVerified: { backgroundColor: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.4)' },
    statusBadgeRejected: { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.4)' },
    statusBadgeText: { fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 },
    inspectBtn: {
        backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8
    },
    inspectBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
    emptyBox: { padding: 40, alignItems: 'center' },
    emptyText: { color: '#6B7280', fontSize: 14 },

    // Modal Styles
    modalBackdrop: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center', alignItems: 'center', padding: 20
    },
    inspectModalCard: {
        width: '100%', maxWidth: 750, maxHeight: '90%',
        backgroundColor: '#1E293B', borderRadius: 16,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden', flex: 1
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 20, backgroundColor: '#0F172A', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)'
    },
    modalTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
    modalSub: { color: '#9CA3AF', fontSize: 13, marginTop: 2 },
    closeBtn: { padding: 4 },
    summaryCard: {
        flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#0F172A',
        borderRadius: 12, padding: 16, gap: 16, marginBottom: 20,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)'
    },
    summaryCol: { minWidth: 140 },
    summaryLabel: { color: '#64748B', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
    summaryVal: { color: '#F1F5F9', fontSize: 13, fontWeight: 'bold', marginTop: 4 },
    sectionHeader: { color: '#94A3B8', fontSize: 12, fontWeight: 'bold', letterSpacing: 1, marginBottom: 12 },
    docInspectCard: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: '#0F172A', borderRadius: 10, padding: 14, marginBottom: 10,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)'
    },
    docInspectTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: 'bold' },
    docInspectStatus: { color: '#64748B', fontSize: 12, marginTop: 2 },
    viewDocBtn: { backgroundColor: '#3B7DDD', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    viewDocBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    reasonSection: { marginTop: 16 },
    reasonLabel: { color: '#94A3B8', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, marginBottom: 8 },
    reasonInput: {
        backgroundColor: '#0F172A', color: '#F8FAFC', borderRadius: 10,
        padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', textAlignVertical: 'top'
    },
    modalFooter: {
        flexDirection: 'row', gap: 12, padding: 20, backgroundColor: '#0F172A',
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)'
    },
    actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    rejectBtn: { backgroundColor: '#EF4444' },
    approveBtn: { backgroundColor: '#22C55E' },
    actionBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },

    // Preview Sub-modal
    previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    previewCard: { width: '100%', maxWidth: 850, height: '85%', backgroundColor: '#0F172A', borderRadius: 16, overflow: 'hidden' },
    previewHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#1E293B' },
    previewImgBox: { flex: 1, padding: 10, justifyContent: 'center', alignItems: 'center' },
    fullImage: { width: '100%', height: '100%' }
});
