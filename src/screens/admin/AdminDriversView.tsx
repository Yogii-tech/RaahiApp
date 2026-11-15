import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator,
    ScrollView, TouchableOpacity, Modal, Image, TextInput, Platform, Linking, useWindowDimensions
} from 'react-native';
import { API_BASE } from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';
import { downloadCSV } from '../../utils/exportUtils';
import { notify } from '../../utils/notify';
import { parseJsonSafe, getApiErrorMessage, createRequestAbort } from '../../utils/json';
import {
    MIN_REQUIRED_DRIVER_DOCS,
    TOTAL_DRIVER_DOC_SLOTS,
    DriverDocEntry,
    getDriverDocCount,
    getDriverDocEntries,
    hasMinimumDriverDocs,
} from '../../utils/driverDocuments';

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
    documentCount?: number;
    totalRides?: number;
}

type DriverModalState =
    | { type: 'none' }
    | { type: 'inspect'; driver: Driver }
    | { type: 'rekyc'; driver: Driver; returnToInspect: boolean }
    | { type: 'delete'; driver: Driver; returnToInspect: boolean };

export default function AdminDriversView({ token, searchQuery = '', initialFilter = 'all' }: { token: string; searchQuery?: string; initialFilter?: 'all' | 'pending' | 'verified' | 'rejected' }) {
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [modalState, setModalState] = useState<DriverModalState>({ type: 'none' });
    const [previewImage, setPreviewImageRaw] = useState<string | null>(null);
    const [previewStatus, setPreviewStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
    const setPreviewImage = (url: string | null) => {
        setPreviewStatus('loading');
        setPreviewImageRaw(url);
    };
    const [rejectionReason, setRejectionReason] = useState('');
    const [submittingAction, setSubmittingAction] = useState(false);
    const [deletingDriverId, setDeletingDriverId] = useState<string | null>(null);
    const [rekycReason, setRekycReason] = useState('');
    const [rekycLoading, setRekycLoading] = useState(false);
    const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>(initialFilter);

    const { fetchWithAuth } = useAuth();
    const fetchWithAuthRef = useRef(fetchWithAuth);
    fetchWithAuthRef.current = fetchWithAuth;
    const driversAbortRef = useRef<AbortController | null>(null);
    const driversReqIdRef = useRef(0);
    const reviewsAbortRef = useRef<AbortController | null>(null);
    const reviewsReqIdRef = useRef(0);
    const isMountedRef = useRef(true);
    const { width } = useWindowDimensions();
    const isMobile = width < 768;

    // Driver reviews state
    const [driverReviews, setDriverReviews] = useState<{ reviews: any[]; averageRating: number; totalReviews: number } | null>(null);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [reviewsError, setReviewsError] = useState<string | null>(null);

    const selectedDriver = modalState.type === 'inspect' ? modalState.driver : null;
    const inspectModalVisible = modalState.type === 'inspect';
    const inspectDocCount = selectedDriver ? getDriverDocCount(selectedDriver) : 0;
    const inspectCanApprove = selectedDriver ? hasMinimumDriverDocs(selectedDriver) : false;
    const inspectDocEntries = selectedDriver ? getDriverDocEntries(selectedDriver) : [];
    const rekycDriver = modalState.type === 'rekyc' ? modalState.driver : null;
    const rekycModalVisible = modalState.type === 'rekyc';
    const deleteConfirmDriver = modalState.type === 'delete' ? modalState.driver : null;

    const loadDrivers = useCallback(async (background = false) => {
        driversAbortRef.current?.abort();
        const { controller, cleanup, didTimeout } = createRequestAbort(12000);
        driversAbortRef.current = controller;
        const reqId = ++driversReqIdRef.current;

        if (background) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setError(null);
        try {
            const res = await fetchWithAuthRef.current(`${API_BASE}/api/admin/drivers`, { signal: controller.signal });
            if (!res.ok) {
                const errData = await parseJsonSafe<any>(res);
                throw new Error(getApiErrorMessage(errData, `Server error: ${res.status}`));
            }
            const d = await parseJsonSafe<Driver[]>(res);
            if (!isMountedRef.current || reqId !== driversReqIdRef.current) return;
            setDrivers(Array.isArray(d) ? d : []);
        } catch (err: any) {
            if (!isMountedRef.current || reqId !== driversReqIdRef.current) return;
            if (err?.name === 'AbortError' && !didTimeout()) return;
            console.error('Failed to load drivers:', err);
            setError(didTimeout() ? 'Request timed out while loading drivers' : (err?.message || 'Failed to load drivers'));
            if (!background) setDrivers([]);
        } finally {
            cleanup();
            if (isMountedRef.current && reqId === driversReqIdRef.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, []);

    useEffect(() => {
        isMountedRef.current = true;
        loadDrivers(false);
        return () => {
            isMountedRef.current = false;
            driversReqIdRef.current += 1;
            reviewsReqIdRef.current += 1;
            driversAbortRef.current?.abort();
            reviewsAbortRef.current?.abort();
        };
    }, [loadDrivers]);

    const closeInspectModal = () => {
        if (submittingAction) return;
        reviewsReqIdRef.current += 1;
        reviewsAbortRef.current?.abort();
        setPreviewImageRaw(null);
        setRejectionReason('');
        setDriverReviews(null);
        setReviewsError(null);
        setReviewsLoading(false);
        setModalState({ type: 'none' });
    };

    const handleInspect = (driver: Driver) => {
        reviewsAbortRef.current?.abort();
        const { controller, cleanup, didTimeout } = createRequestAbort(10000);
        reviewsAbortRef.current = controller;
        const reqId = ++reviewsReqIdRef.current;

        setPreviewImageRaw(null);
        setRejectionReason(driver.rejectionReason || '');
        setModalState({ type: 'inspect', driver });
        setDriverReviews(null);
        setReviewsError(null);
        setReviewsLoading(true);

        fetchWithAuthRef.current(`${API_BASE}/api/admin/reviews/driver/${driver.id}`, { signal: controller.signal })
            .then(async (res: Response) => {
                if (!isMountedRef.current || reqId !== reviewsReqIdRef.current) return;
                const d = await parseJsonSafe<any>(res);
                if (!isMountedRef.current || reqId !== reviewsReqIdRef.current) return;
                if (res.ok && d && typeof d === 'object') {
                    setDriverReviews({
                        reviews: Array.isArray(d.reviews) ? d.reviews : [],
                        averageRating: typeof d.averageRating === 'number' ? d.averageRating : 0,
                        totalReviews: typeof d.totalReviews === 'number' ? d.totalReviews : 0,
                    });
                } else {
                    setReviewsError(getApiErrorMessage(d, `Could not load reviews (${res.status})`));
                }
            })
            .catch((err: any) => {
                if (!isMountedRef.current || reqId !== reviewsReqIdRef.current) return;
                if (err?.name === 'AbortError' && !didTimeout()) return;
                setReviewsError(didTimeout() ? 'Timed out loading reviews' : 'Could not load reviews');
            })
            .finally(() => {
                cleanup();
                if (isMountedRef.current && reqId === reviewsReqIdRef.current) {
                    setReviewsLoading(false);
                }
            });
    };

    const handleVerifyAction = async (status: 'verified' | 'rejected') => {
        if (!selectedDriver || submittingAction) return;
        if (status === 'verified' && !hasMinimumDriverDocs(selectedDriver)) {
            const uploadedCount = getDriverDocCount(selectedDriver);
            notify(
                'Insufficient Documents',
                `Driver has ${uploadedCount}/${TOTAL_DRIVER_DOC_SLOTS} uploaded documents. At least ${MIN_REQUIRED_DRIVER_DOCS} documents are required before verification.`
            );
            return;
        }
        if (status === 'rejected' && !rejectionReason.trim()) {
            notify('Reason Required', 'Please enter a rejection reason (e.g. RC document photo is unclear).');
            return;
        }

        setSubmittingAction(true);
        const { controller, cleanup, didTimeout } = createRequestAbort(15000);
        try {
            const res = await fetchWithAuthRef.current(`${API_BASE}/api/admin/drivers/${selectedDriver.id}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    status,
                    reason: status === 'rejected' ? rejectionReason.trim() : ''
                })
            });

            const data = await parseJsonSafe<any>(res);
            if (!isMountedRef.current) return;
            if (res.ok) {
                notify('Success', `Driver ${selectedDriver.name} marked as ${status.toUpperCase()}`);
                reviewsReqIdRef.current += 1;
                reviewsAbortRef.current?.abort();
                setPreviewImageRaw(null);
                setRejectionReason('');
                setDriverReviews(null);
                setReviewsError(null);
                setModalState({ type: 'none' });
                loadDrivers(true);
            } else {
                notify('Error', getApiErrorMessage(data, `Failed to update verification status (${res.status})`));
            }
        } catch (err: any) {
            if (!isMountedRef.current) return;
            notify('Error', didTimeout() ? 'Request timed out while updating status' : 'Connection error while updating status');
        } finally {
            cleanup();
            if (isMountedRef.current) {
                setSubmittingAction(false);
            }
        }
    };

    // Step 1: Delete button pressed -> only open the confirmation popup (nothing is deleted yet).
    const handleDeleteDriver = (driver: Driver, fromInspect = false) => {
        if (deletingDriverId || submittingAction) return;
        setModalState({ type: 'delete', driver, returnToInspect: fromInspect });
    };

    // "No" -> close the popup (or return to Inspect if opened from there), nothing happens.
    const handleCancelDelete = () => {
        if (deletingDriverId) return;
        if (modalState.type === 'delete' && modalState.returnToInspect) {
            setModalState({ type: 'inspect', driver: modalState.driver });
        } else {
            setModalState({ type: 'none' });
        }
    };

    // "Yes" -> perform the actual delete and close.
    const handleConfirmDelete = async () => {
        if (modalState.type !== 'delete' || deletingDriverId) return;
        await executeDelete(modalState.driver);
    };

    const executeDelete = async (driver: Driver) => {
        setDeletingDriverId(driver.id);
        const { controller, cleanup, didTimeout } = createRequestAbort(15000);
        try {
            const res = await fetchWithAuthRef.current(`${API_BASE}/api/admin/drivers/${driver.id}`, {
                method: 'DELETE',
                signal: controller.signal,
            });
            const data = await parseJsonSafe<any>(res);
            if (!isMountedRef.current) return;
            if (res.ok) {
                notify('Deleted', data?.message || `Driver ${driver.name} deleted successfully`);
                setPreviewImageRaw(null);
                setRejectionReason('');
                setDriverReviews(null);
                setReviewsError(null);
                setModalState({ type: 'none' });
                loadDrivers(true);
            } else {
                notify('Error', getApiErrorMessage(data, `Failed to delete driver (${res.status})`));
            }
        } catch {
            if (!isMountedRef.current) return;
            notify('Error', didTimeout() ? 'Request timed out while deleting driver' : 'Connection error while deleting driver');
        } finally {
            cleanup();
            if (isMountedRef.current) {
                setDeletingDriverId(null);
            }
        }
    };

    const handleOpenReKYC = (driver: Driver, fromInspect = false) => {
        if (submittingAction || rekycLoading) return;
        setRekycReason('Your uploaded documents could not be verified or are missing. Please re-upload your driving license, vehicle RC, and other KYC documents.');
        setModalState({ type: 'rekyc', driver, returnToInspect: fromInspect });
    };

    const handleCloseReKYC = () => {
        if (rekycLoading) return;
        if (modalState.type === 'rekyc' && modalState.returnToInspect) {
            setModalState({ type: 'inspect', driver: modalState.driver });
        } else {
            setModalState({ type: 'none' });
        }
    };

    const handleExecuteReKYC = async () => {
        if (!rekycDriver || rekycLoading) return;
        setRekycLoading(true);
        const { controller, cleanup, didTimeout } = createRequestAbort(15000);
        try {
            const res = await fetchWithAuthRef.current(`${API_BASE}/api/admin/drivers/${rekycDriver.id}/rekyc`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    reason: rekycReason.trim()
                })
            });

            const data = await parseJsonSafe<any>(res);
            if (!isMountedRef.current) return;
            if (res.ok) {
                notify('Notification Sent', `Re-KYC request sent to ${rekycDriver.name} (${rekycDriver.phone}). The driver will be notified to re-upload documents.`);
                setPreviewImageRaw(null);
                setRejectionReason('');
                setDriverReviews(null);
                setReviewsError(null);
                setModalState({ type: 'none' });
                loadDrivers(true);
            } else {
                notify('Error', getApiErrorMessage(data, `Failed to request Re-KYC (${res.status})`));
            }
        } catch {
            if (!isMountedRef.current) return;
            notify('Error', didTimeout() ? 'Request timed out while requesting Re-KYC' : 'Connection error while requesting Re-KYC');
        } finally {
            cleanup();
            if (isMountedRef.current) {
                setRekycLoading(false);
            }
        }
    };

    const pendingCount = drivers.filter(d => (d.verificationStatus || 'pending') === 'pending').length;
    const verifiedCount = drivers.filter(d => d.verificationStatus === 'verified').length;
    const rejectedCount = drivers.filter(d => d.verificationStatus === 'rejected').length;

    const filteredDrivers = drivers.filter(d => {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
            d.id?.toLowerCase().includes(q) ||
            d.name?.toLowerCase().includes(q) ||
            d.phone?.toLowerCase().includes(q) ||
            d.vehicleNumber?.toLowerCase().includes(q) ||
            d.location?.toLowerCase().includes(q);

        const status = d.verificationStatus || 'pending';
        if (activeFilter === 'pending') return matchesSearch && status === 'pending';
        if (activeFilter === 'verified') return matchesSearch && status === 'verified';
        if (activeFilter === 'rejected') return matchesSearch && status === 'rejected';
        return matchesSearch;
    });

    const getFullUrl = (url?: string) => {
        if (!url) return '';
        let full = url.trim();
        // Reject dangerous schemes (e.g., javascript:, data:, vbscript:)
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/i.test(full) && !/^https?:\/\//i.test(full)) {
            return '';
        }
        if (!/^https?:\/\//i.test(full)) {
            full = `${API_BASE}${full.startsWith('/') ? '' : '/'}${full}`;
        }
        // Browsers block http:// images on an https:// page (mixed content), which
        // rendered as an empty preview in production. Upgrade non-local URLs.
        if (full.startsWith('http://') && !/^http:\/\/(localhost|127\.0\.0\.1|10\.|192\.168\.)/.test(full)) {
            full = 'https://' + full.slice('http://'.length);
        }
        return full;
    };

    const isPdf = (url: string) => /\.pdf(\?|#|$)/i.test(url);

    const openExternally = (url: string) => {
        const safeUrl = getFullUrl(url);
        if (!safeUrl || !/^https?:\/\//i.test(safeUrl)) return;
        if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(safeUrl, '_blank', 'noopener,noreferrer');
        else Linking.openURL(safeUrl).catch(() => {});
    };

    if (loading && drivers.length === 0) return <ActivityIndicator color="#3B7DDD" size="large" style={{ marginTop: 60 }} />;

    if (error && drivers.length === 0) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
                <Text style={{ color: '#EF4444', fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>{error}</Text>
                <TouchableOpacity style={styles.exportBtn} onPress={() => loadDrivers(false)}>
                    <Text style={styles.exportBtnText}>↻ Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={[styles.container, isMobile && { padding: 16 }]}>
            {/* Header Section */}
            <View style={[styles.headerArea, isMobile && { flexDirection: 'column', alignItems: 'flex-start', gap: 12 }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.pageTitle, isMobile && { fontSize: 22 }]}>Driver Onboarding & Verification</Text>
                    <Text style={styles.pageSubtitle}>
                        Drivers must have at least {MIN_REQUIRED_DRIVER_DOCS} of {TOTAL_DRIVER_DOC_SLOTS} distinct documents uploaded before approval and ride-posting privileges.
                    </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                    <TouchableOpacity
                        style={[styles.exportBtn, { backgroundColor: '#1F2937', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }, refreshing && { opacity: 0.6 }]}
                        onPress={() => loadDrivers(true)}
                        disabled={refreshing}
                    >
                        <Text style={styles.exportBtnText}>{refreshing ? '↻ Refreshing...' : '↻ Refresh'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.exportBtn}
                        onPress={() => downloadCSV(filteredDrivers, 'Driver_Onboarding_Report')}
                    >
                        <Text style={styles.exportBtnText}>Export CSV</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {error && (
                <Text style={{ color: '#EF4444', fontSize: 12, marginBottom: 12 }}>Refresh failed: {error}</Text>
            )}

            {/* Filter Tabs */}
            <View style={[styles.filterRow, { flexWrap: 'wrap' }]}>
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

                {isMobile ? (
                    <FlatList
                        data={filteredDrivers}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        renderItem={({ item, index }) => {
                            const status = item.verificationStatus || 'pending';

                            return (
                                <View style={[styles.mobileDriverCard, index % 2 === 1 && styles.tableRowAlt]}>
                                    <View style={styles.mobileCardTop}>
                                        <View style={{ flex: 1, minWidth: 0 }}>
                                            <Text style={styles.driverName} numberOfLines={1} ellipsizeMode="tail">{item.name || 'Unknown Driver'}</Text>
                                            <Text style={styles.driverPhone} numberOfLines={1}>{item.phone || 'No phone'}</Text>
                                        </View>
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

                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                                        <Text style={styles.locationText}>📍 {item.location || 'Uttarakhand'}</Text>
                                        <Text style={styles.vehicleNumber}>
                                            {item.vehicleName || item.vehicleType || 'Vehicle'} • {item.vehicleNumber || '—'}
                                        </Text>
                                    </View>

                                    <DriverDocBadgesList driver={item} />

                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                                        <TouchableOpacity
                                            style={styles.inspectBtn}
                                            onPress={() => handleInspect(item)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={{ fontSize: 12, marginRight: 3 }}>👁</Text>
                                            <Text style={styles.inspectBtnText}>Inspect</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.rekycBtn}
                                            onPress={() => handleOpenReKYC(item)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={{ fontSize: 12, marginRight: 3 }}>🔄</Text>
                                            <Text style={styles.rekycBtnText}>Re-KYC</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.deleteBtn, deletingDriverId === item.id && { opacity: 0.6 }]}
                                            onPress={() => handleDeleteDriver(item)}
                                            activeOpacity={0.8}
                                            disabled={deletingDriverId === item.id}
                                        >
                                            <Text style={{ fontSize: 12, marginRight: 3 }}>🗑</Text>
                                            <Text style={styles.deleteBtnText}>{deletingDriverId === item.id ? '...' : 'Delete'}</Text>
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
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: '100%' }}>
                        <View style={{ minWidth: 1250, flex: 1 }}>
                        {/* Table Header */}
                        <View style={styles.tableHeader}>
                            <Text style={[styles.headerCell, { flex: 2 }]}>DRIVER NAME & PHONE</Text>
                            <Text style={[styles.headerCell, { flex: 1.2 }]}>LOCATION</Text>
                            <Text style={[styles.headerCell, { flex: 1.8 }]}>VEHICLE DETAILS</Text>
                            <Text style={[styles.headerCell, { flex: 2.5 }]}>DOCUMENTS STATUS</Text>
                            <Text style={[styles.headerCell, { flex: 1.5 }]}>SUBMITTED</Text>
                            <Text style={[styles.headerCell, { flex: 1.5 }]}>VERIFICATION STATUS</Text>
                            <Text style={[styles.headerCell, { flex: 2.4, textAlign: 'center' }]}>ACTIONS</Text>
                        </View>

                        {/* Table Body */}
                        <FlatList
                            data={filteredDrivers}
                            keyExtractor={item => item.id}
                            renderItem={({ item, index }) => {
                                const status = item.verificationStatus || 'pending';

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
                                        <View style={{ flex: 2.5, justifyContent: 'center' }}>
                                            <DriverDocBadgesList driver={item} showLongLabels />
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
                                        <View style={{ flex: 2.4, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                                            <TouchableOpacity
                                                style={styles.inspectBtn}
                                                onPress={() => handleInspect(item)}
                                                activeOpacity={0.8}
                                            >
                                                <Text style={{ fontSize: 12, marginRight: 3 }}>👁</Text>
                                                <Text style={styles.inspectBtnText}>Inspect</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.rekycBtn}
                                                onPress={() => handleOpenReKYC(item)}
                                                activeOpacity={0.8}
                                            >
                                                <Text style={{ fontSize: 12, marginRight: 3 }}>🔄</Text>
                                                <Text style={styles.rekycBtnText}>Re-KYC</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.deleteBtn, deletingDriverId === item.id && { opacity: 0.6 }]}
                                                onPress={() => handleDeleteDriver(item)}
                                                activeOpacity={0.8}
                                                disabled={deletingDriverId === item.id}
                                            >
                                                <Text style={{ fontSize: 12, marginRight: 3 }}>🗑</Text>
                                                <Text style={styles.deleteBtnText}>{deletingDriverId === item.id ? '...' : 'Delete'}</Text>
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
                )}
            </View>

            {/* Document Inspection Modal */}
            {inspectModalVisible && selectedDriver && (
                <Modal
                    visible={inspectModalVisible}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => {
                        if (previewImage) {
                            setPreviewImageRaw(null);
                            return;
                        }
                        closeInspectModal();
                    }}
                >
                    <View style={[styles.modalBackdrop, isMobile && { padding: 12 }]}>
                        <View style={styles.inspectModalCard}>
                            {/* Modal Header */}
                            <View style={[styles.modalHeader, isMobile && { padding: 14 }]}>
                                <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                                    <Text style={styles.modalTitle}>Inspect Driver Documents</Text>
                                    <Text style={styles.modalSub}>{selectedDriver.name} ({selectedDriver.phone})</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={closeInspectModal}
                                    disabled={submittingAction}
                                    style={[styles.closeBtn, submittingAction && { opacity: 0.4 }]}
                                >
                                    <Text style={{ color: '#9CA3AF', fontSize: 20, fontWeight: 'bold' }}>✕</Text>
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={{ flex: 1, padding: isMobile ? 14 : 20 }} showsVerticalScrollIndicator={false}>
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
                                <View style={styles.sectionHeaderRow}>
                                    <Text style={styles.sectionHeader}>
                                        SUBMITTED KYC DOCUMENTS ({inspectDocCount}/{TOTAL_DRIVER_DOC_SLOTS})
                                    </Text>
                                    <View
                                        testID="admin-inspect-doc-eligibility"
                                        style={[
                                            styles.eligibilityPill,
                                            inspectCanApprove ? styles.eligibilityPillReady : styles.eligibilityPillBlocked,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.eligibilityPillText,
                                                { color: inspectCanApprove ? '#22C55E' : '#F59E0B' },
                                            ]}
                                        >
                                            {inspectCanApprove
                                                ? `✓ Ready (${inspectDocCount}/${TOTAL_DRIVER_DOC_SLOTS})`
                                                : `Needs ${MIN_REQUIRED_DRIVER_DOCS} Docs (${inspectDocCount}/${MIN_REQUIRED_DRIVER_DOCS})`}
                                        </Text>
                                    </View>
                                </View>

                                {inspectDocEntries.map((entry: DriverDocEntry) => {
                                    const resolvedUrl = entry.url ? getFullUrl(entry.url) : '';
                                    return (
                                        <DocInspectCard
                                            key={entry.slot.formKey}
                                            title={entry.slot.adminTitle}
                                            url={resolvedUrl}
                                            canMeetMinDocs={inspectCanApprove}
                                            onPreview={() => resolvedUrl && setPreviewImage(resolvedUrl)}
                                        />
                                    );
                                })}

                                {/* Passenger Reviews Section */}
                                <Text style={[styles.sectionHeader, { marginTop: 20 }]}>PASSENGER REVIEWS</Text>
                                {reviewsLoading ? (
                                    <ActivityIndicator color="#3B7DDD" style={{ marginVertical: 16 }} />
                                ) : reviewsError ? (
                                    <View style={{ backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
                                        <Text style={{ color: '#FCA5A5', fontSize: 13, textAlign: 'center' }}>
                                            {reviewsError}
                                        </Text>
                                    </View>
                                ) : driverReviews && driverReviews.totalReviews > 0 ? (
                                    <View style={{ backgroundColor: '#F0F4FF', borderRadius: 12, padding: 14, marginBottom: 12 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                            <Text style={{ fontSize: 28, fontWeight: '900', color: '#FFB300' }}>
                                                {(driverReviews.averageRating ?? 0).toFixed(1)}
                                            </Text>
                                            <Text style={{ fontSize: 24, marginLeft: 4 }}>⭐</Text>
                                            <Text style={{ marginLeft: 8, color: '#6B7280', fontSize: 13 }}>
                                                {driverReviews.totalReviews} {driverReviews.totalReviews === 1 ? 'review' : 'reviews'}
                                            </Text>
                                        </View>
                                        {driverReviews.reviews.map((rev: any, idx: number) => {
                                            const ratingVal = Math.max(0, Math.min(5, Math.round(Number(rev.rating) || 0)));
                                            return (
                                                <View key={idx} style={{ borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: '#E5E7EB', paddingTop: idx > 0 ? 10 : 0, marginTop: idx > 0 ? 10 : 0 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <Text style={{ fontWeight: '700', color: '#1F2937', fontSize: 13 }}>
                                                            {rev.passengerName || 'Passenger'}
                                                        </Text>
                                                        <Text style={{ color: '#FFB300', fontSize: 13, fontWeight: '700' }}>
                                                            {'⭐'.repeat(ratingVal)} {rev.rating}/5
                                                        </Text>
                                                    </View>
                                                    {rev.comment ? (
                                                        <Text style={{ color: '#374151', fontSize: 12, marginTop: 4, lineHeight: 18 }}>
                                                            "{rev.comment}"
                                                        </Text>
                                                    ) : null}
                                                    <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: 4 }}>
                                                        {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                                                    </Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                ) : (
                                    <View style={{ backgroundColor: '#F9FAFB', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 12 }}>
                                        <Text style={{ fontSize: 24, marginBottom: 4 }}>⭐</Text>
                                        <Text style={{ color: '#6B7280', fontSize: 13, textAlign: 'center' }}>
                                            No reviews yet for this driver.
                                        </Text>
                                    </View>
                                )}

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

                            {/* Minimum Document Warning Banner */}
                            {!inspectCanApprove && (
                                <View testID="admin-verify-min-docs-warning" style={styles.approveWarningBanner}>
                                    <Text style={styles.approveWarningText}>
                                        ⚠ Cannot approve verification yet ({inspectDocCount}/{TOTAL_DRIVER_DOC_SLOTS} documents uploaded). At least {MIN_REQUIRED_DRIVER_DOCS} distinct documents are required.
                                    </Text>
                                </View>
                            )}

                            {/* Modal Action Buttons */}
                            <View style={[styles.modalFooter, isMobile && { flexWrap: 'wrap', padding: 14, gap: 8 }]}>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.deleteDriverBtn, isMobile && { minWidth: '46%', paddingVertical: 10 }, (submittingAction || deletingDriverId === selectedDriver.id) && { opacity: 0.6 }]}
                                    onPress={() => handleDeleteDriver(selectedDriver, true)}
                                    disabled={submittingAction || deletingDriverId === selectedDriver.id}
                                >
                                    <Text style={styles.actionBtnText}>🗑 Delete</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.rekycModalBtn, isMobile && { minWidth: '46%', paddingVertical: 10 }, submittingAction && { opacity: 0.6 }]}
                                    onPress={() => handleOpenReKYC(selectedDriver, true)}
                                    disabled={submittingAction}
                                >
                                    <Text style={styles.actionBtnText}>🔄 Re-KYC</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.rejectBtn, isMobile && { minWidth: '46%', paddingVertical: 10 }, submittingAction && { opacity: 0.6 }]}
                                    onPress={() => handleVerifyAction('rejected')}
                                    disabled={submittingAction}
                                >
                                    <Text style={styles.actionBtnText}>✕ Reject</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    testID="admin-inspect-approve-btn"
                                    style={[
                                        styles.actionBtn,
                                        styles.approveBtn,
                                        isMobile && { minWidth: '46%', paddingVertical: 10 },
                                        !inspectCanApprove && styles.approveBtnDisabled,
                                        submittingAction && { opacity: 0.6 },
                                    ]}
                                    onPress={() => handleVerifyAction('verified')}
                                    disabled={submittingAction || !inspectCanApprove}
                                    accessibilityState={{ disabled: submittingAction || !inspectCanApprove }}
                                >
                                    {submittingAction ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.actionBtnText}>✓ Approve</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Inline Document Preview Overlay (avoids stacked React Native Modals) */}
                        {previewImage && (
                            <View style={[StyleSheet.absoluteFillObject, styles.previewBackdrop, { zIndex: 20 }]}>
                                <View style={styles.previewCard}>
                                    <View style={styles.previewHeader}>
                                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Document Preview</Text>
                                        <TouchableOpacity onPress={() => setPreviewImage(null)}>
                                            <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold' }}>✕</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.previewImgBox}>
                                        {isPdf(previewImage) ? (
                                            Platform.OS === 'web' ? (
                                                React.createElement('iframe', {
                                                    src: previewImage,
                                                    title: 'Document Preview',
                                                    style: { width: '100%', height: '100%', border: 0, backgroundColor: '#fff', borderRadius: 8 },
                                                })
                                            ) : (
                                                <Text style={styles.previewMsg}>PDF documents open in your browser.</Text>
                                            )
                                        ) : previewStatus === 'error' ? (
                                            <Text style={styles.previewMsg}>
                                                ⚠ Could not load this document.{'\n'}The file may be missing on the server.
                                            </Text>
                                        ) : (
                                            <>
                                                <Image
                                                    source={{ uri: previewImage }}
                                                    style={styles.fullImage}
                                                    resizeMode="contain"
                                                    onLoad={() => setPreviewStatus('loaded')}
                                                    onError={() => setPreviewStatus('error')}
                                                />
                                                {previewStatus === 'loading' && (
                                                    <ActivityIndicator color="#3B7DDD" size="large" style={StyleSheet.absoluteFill} />
                                                )}
                                            </>
                                        )}
                                    </View>
                                    <TouchableOpacity style={styles.openExternalBtn} onPress={() => openExternally(previewImage)}>
                                        <Text style={styles.viewDocBtnText}>Open in new tab ↗</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                </Modal>
            )}

            {/* Re-KYC Confirmation Modal */}
            {rekycModalVisible && rekycDriver && (
                <Modal
                    visible={rekycModalVisible}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={handleCloseReKYC}
                >
                    <View style={[styles.modalBackdrop, isMobile && { padding: 12 }]}>
                        <View style={styles.rekycModalCard}>
                            <View style={[styles.modalHeader, isMobile && { padding: 14 }]}>
                                <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                                    <Text style={styles.modalTitle}>Request Re-KYC</Text>
                                    <Text style={styles.modalSub}>
                                        Driver: {rekycDriver.name} ({rekycDriver.phone})
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={handleCloseReKYC}
                                    disabled={rekycLoading}
                                    style={[styles.closeBtn, rekycLoading && { opacity: 0.4 }]}
                                >
                                    <Text style={{ color: '#9CA3AF', fontSize: 20, fontWeight: 'bold' }}>✕</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={{ padding: 20 }}>
                                <View style={styles.rekycInfoBox}>
                                    <Text style={styles.rekycInfoIcon}>ℹ️</Text>
                                    <Text style={styles.rekycInfoText}>
                                        This will notify the driver via push notification and in-app banner to re-upload their documents.
                                        Old document links will be cleared so they can submit fresh copies.
                                    </Text>
                                </View>

                                <Text style={styles.reasonLabel}>INSTRUCTIONS / REASON FOR DRIVER</Text>
                                <TextInput
                                    style={styles.reasonInput}
                                    placeholder="Enter instructions for re-uploading documents..."
                                    placeholderTextColor="#6B7280"
                                    multiline={true}
                                    numberOfLines={3}
                                    value={rekycReason}
                                    onChangeText={setRekycReason}
                                />

                                <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, { backgroundColor: '#374151' }, rekycLoading && { opacity: 0.6 }]}
                                        onPress={handleCloseReKYC}
                                        disabled={rekycLoading}
                                    >
                                        <Text style={styles.actionBtnText}>Cancel</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.rekycConfirmBtn, rekycLoading && { opacity: 0.6 }]}
                                        onPress={handleExecuteReKYC}
                                        disabled={rekycLoading}
                                    >
                                        {rekycLoading ? (
                                            <ActivityIndicator color="#FFFFFF" size="small" />
                                        ) : (
                                            <Text style={styles.actionBtnText}>
                                                🔄 Send Re-KYC Request
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {/* Delete Driver Confirmation Popup */}
            {deleteConfirmDriver && (
                <Modal
                    visible={!!deleteConfirmDriver}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={handleCancelDelete}
                >
                    <View style={[styles.modalBackdrop, { zIndex: 9999 }]}>
                        <View style={styles.deleteConfirmCard}>
                            <Text style={styles.deleteConfirmIcon}>⚠️</Text>
                            <Text style={styles.deleteConfirmTitle}>Do you really want to delete this driver?</Text>
                            <Text style={styles.deleteConfirmName}>
                                {deleteConfirmDriver.name} ({deleteConfirmDriver.phone})
                            </Text>
                            <Text style={styles.deleteConfirmText}>
                                This will also permanently delete all their rides and bookings. This action cannot be undone.
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20, alignSelf: 'stretch' }}>
                                <TouchableOpacity
                                    style={[styles.actionBtn, { backgroundColor: '#374151' }, !!deletingDriverId && { opacity: 0.6 }]}
                                    onPress={handleCancelDelete}
                                    disabled={!!deletingDriverId}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.actionBtnText}>No</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionBtn, { backgroundColor: '#DC2626' }, !!deletingDriverId && { opacity: 0.6 }]}
                                    onPress={handleConfirmDelete}
                                    disabled={!!deletingDriverId}
                                    activeOpacity={0.8}
                                >
                                    {deletingDriverId ? (
                                        <ActivityIndicator color="#FFFFFF" size="small" />
                                    ) : (
                                        <Text style={styles.actionBtnText}>Yes, Delete</Text>
                                    )}
                                </TouchableOpacity>
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

const DriverDocBadgesList = ({ driver, showLongLabels = false }: { driver: Driver; showLongLabels?: boolean }) => {
    const entries = getDriverDocEntries(driver);
    const docCount = getDriverDocCount(driver);
    const canVerify = hasMinimumDriverDocs(driver);

    return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <View
                testID={`driver-doc-count-${driver.id}`}
                style={[
                    styles.docBadge,
                    canVerify ? styles.docCountChipReady : styles.docCountChipInsufficient,
                ]}
            >
                <Text
                    style={[
                        styles.docBadgeText,
                        { color: canVerify ? '#22C55E' : '#F87171' },
                    ]}
                >
                    {docCount}/{TOTAL_DRIVER_DOC_SLOTS} Docs · {canVerify ? 'Ready' : `Needs ${MIN_REQUIRED_DRIVER_DOCS}`}
                </Text>
            </View>
            {entries.map((entry) => {
                const isUploaded = Boolean(entry.url);
                if (entry.slot.formKey === 'ownership' && !isUploaded) {
                    return null;
                }
                const label = showLongLabels
                    ? ({
                        dl: 'Driving Licence',
                        rc: 'Vehicle RC',
                        pollution: 'Pollution Cert',
                        image: 'Vehicle Photo',
                        ownership: 'Ownership Proof',
                    }[entry.slot.formKey])
                    : entry.slot.shortLabel;
                return <DocBadge key={entry.slot.formKey} label={label} isUploaded={isUploaded} />;
            })}
        </View>
    );
};

const DocInspectCard = ({
    title,
    url,
    canMeetMinDocs = false,
    onPreview,
}: {
    title: string;
    url: string;
    canMeetMinDocs?: boolean;
    onPreview: () => void;
}) => (
    <View style={styles.docInspectCard}>
        <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
            <Text style={styles.docInspectTitle}>{title}</Text>
            <Text style={styles.docInspectStatus}>
                {url
                    ? '✓ Document uploaded'
                    : canMeetMinDocs
                        ? 'Not uploaded (optional once 3+ docs provided)'
                        : '⚠ Missing document'}
            </Text>
        </View>
        {url ? (
            <TouchableOpacity style={styles.viewDocBtn} onPress={onPreview}>
                <Text style={styles.viewDocBtnText}>View Image 👁</Text>
            </TouchableOpacity>
        ) : (
            <Text
                style={{
                    color: canMeetMinDocs ? '#94A3B8' : '#F59E0B',
                    fontSize: 12,
                    fontWeight: 'bold',
                }}
            >
                {canMeetMinDocs ? 'Not Uploaded' : 'Missing'}
            </Text>
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
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8
    },
    inspectBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
    rekycBtn: {
        backgroundColor: '#D97706', flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8
    },
    rekycBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
    deleteBtn: {
        backgroundColor: '#991B1B', flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
        borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)'
    },
    deleteBtnText: { color: '#FCA5A5', fontWeight: 'bold', fontSize: 12 },
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
    deleteDriverBtn: { backgroundColor: '#7F1D1D', borderWidth: 1, borderColor: 'rgba(239,68,68,0.5)' },
    rekycModalBtn: { backgroundColor: '#D97706' },
    rekycConfirmBtn: { backgroundColor: '#D97706' },
    rejectBtn: { backgroundColor: '#EF4444' },
    approveBtn: { backgroundColor: '#22C55E' },
    approveBtnDisabled: { backgroundColor: '#334155', opacity: 0.55 },
    docCountChipReady: { backgroundColor: 'rgba(34,197,94,0.16)', borderColor: 'rgba(34,197,94,0.45)' },
    docCountChipInsufficient: { backgroundColor: 'rgba(239,68,68,0.14)', borderColor: 'rgba(239,68,68,0.4)' },
    sectionHeaderRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 8, marginBottom: 12,
    },
    eligibilityPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
    eligibilityPillReady: { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.35)' },
    eligibilityPillBlocked: { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.35)' },
    eligibilityPillText: { fontSize: 11, fontWeight: 'bold' },
    approveWarningBanner: {
        backgroundColor: 'rgba(245,158,11,0.12)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(245,158,11,0.3)',
        paddingHorizontal: 18,
        paddingVertical: 10,
    },
    approveWarningText: { color: '#FDE68A', fontSize: 12, fontWeight: '600', textAlign: 'center' },
    actionBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },

    // Re-KYC Modal
    rekycModalCard: {
        width: '100%', maxWidth: 540,
        backgroundColor: '#1E293B', borderRadius: 16,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden'
    },
    rekycInfoBox: {
        flexDirection: 'row', alignItems: 'flex-start',
        backgroundColor: 'rgba(217, 119, 6, 0.15)',
        borderWidth: 1, borderColor: 'rgba(217, 119, 6, 0.4)',
        borderRadius: 10, padding: 12, marginBottom: 16
    },
    rekycInfoIcon: { fontSize: 16, marginRight: 8, marginTop: 2 },
    rekycInfoText: { flex: 1, color: '#FDE68A', fontSize: 13, lineHeight: 18 },

    // Delete confirmation popup
    deleteConfirmCard: {
        width: '100%', maxWidth: 420, backgroundColor: '#1E293B', borderRadius: 16,
        borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)', padding: 24, alignItems: 'center'
    },
    deleteConfirmIcon: { fontSize: 36, marginBottom: 8 },
    deleteConfirmTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
    deleteConfirmName: { color: '#FCA5A5', fontSize: 14, fontWeight: 'bold', marginTop: 10, textAlign: 'center' },
    deleteConfirmText: { color: '#9CA3AF', fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 19 },

    // Preview Sub-modal
    previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    previewCard: { width: '100%', maxWidth: 850, height: '85%', backgroundColor: '#0F172A', borderRadius: 16, overflow: 'hidden' },
    previewHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#1E293B' },
    previewImgBox: { flex: 1, padding: 10, justifyContent: 'center', alignItems: 'stretch' },
    fullImage: { flex: 1, width: '100%', height: '100%' },
    previewMsg: { color: '#CBD5E1', fontSize: 14, textAlign: 'center', lineHeight: 22 },
    openExternalBtn: { backgroundColor: '#3B7DDD', margin: 12, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
    mobileDriverCard: { padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', gap: 8 },
    mobileCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
});
