(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import React from 'react';
import { Platform } from 'react-native';
import renderer, { act, ReactTestInstance } from 'react-test-renderer';

const mockFetchWithAuth = jest.fn();
const mockSetAuth = jest.fn(async () => {});
const mockLogout = jest.fn(async () => {});
const mockNotify = jest.fn();
const mockPickAndUploadDocument = jest.fn();
const mockApiRequest = jest.fn();
let mockAuthUser: any = null;

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));

jest.mock('../src/apiConfig', () => ({
    API_BASE: 'http://localhost:8080',
}));

jest.mock('../src/context/AuthContext', () => ({
    useAuth: () => ({
        token: 'test-token',
        refreshToken: 'test-refresh',
        user: mockAuthUser,
        setAuth: mockSetAuth,
        logout: mockLogout,
        fetchWithAuth: mockFetchWithAuth,
    }),
}));

jest.mock('../src/context/ThemeContext', () => ({
    useTheme: () => ({
        isDark: false,
        colors: {
            background: '#FFFFFF',
            cardColor: '#FFFFFF',
            textColor: '#111827',
            subtextColor: '#6B7280',
            borderColor: '#E5E7EB',
            primary: '#3B7DDD',
            inputFillColor: '#F8FAFC',
            inputBorderColor: '#CBD5E1',
        },
    }),
}));

jest.mock('../src/context/LanguageContext', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}));

jest.mock('../src/utils/notify', () => ({
    notify: (...args: any[]) => mockNotify(...args),
}));

jest.mock('../src/utils/documentUpload', () => ({
    pickAndUploadDocument: (...args: any[]) => mockPickAndUploadDocument(...args),
    notify: (...args: any[]) => mockNotify(...args),
}));

jest.mock('../src/utils/api', () => ({
    apiRequest: (...args: any[]) => mockApiRequest(...args),
    getAuthSessionGeneration: () => 1,
}));

jest.mock('../src/utils/exportUtils', () => ({
    downloadCSV: jest.fn(),
}));

jest.mock('../src/utils/browserHistory', () => ({
    useBrowserBack: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import AdminDriversView, { Driver } from '../src/screens/admin/AdminDriversView';
import ResubmitDocsView from '../src/screens/ResubmitDocsView';
import VehicleDetailsScreen from '../src/screens/VehicleDetailsScreen';
import { DriverKycDocsCard } from '../src/components/DriverKycDocsCard';
import {
    countDistinctDriverDocs,
    getDriverDocCount,
    hasMinimumDriverDocs,
    validateMinimumDriverDocs,
} from '../src/utils/driverDocuments';

function flattenText(node: ReactTestInstance | string): string {
    if (typeof node === 'string') return node;
    return node.children.map((child) => flattenText(child)).join('');
}

async function flushMicrotasks(ticks: number = 4) {
    for (let i = 0; i < ticks; i += 1) {
        await Promise.resolve();
    }
}

describe('driverDocuments helper (3-document minimum)', () => {
    test('counts distinct non-empty trimmed URLs across all 5 slots and blocks duplicate URLs', () => {
        expect(countDistinctDriverDocs({})).toBe(0);
        expect(hasMinimumDriverDocs({})).toBe(false);

        const twoDocs = {
            dlUrl: 'https://cdn.example.com/dl.png',
            rcUrl: 'https://cdn.example.com/rc.png',
            pollutionUrl: '   ',
        };
        expect(countDistinctDriverDocs(twoDocs)).toBe(2);
        expect(hasMinimumDriverDocs(twoDocs)).toBe(false);
        expect(validateMinimumDriverDocs(twoDocs)).toContain('at least 3 distinct');

        const duplicateThreeSlots = {
            dl: 'https://cdn.example.com/same.png',
            rc: ' https://cdn.example.com/same.png ',
            pollution: 'https://cdn.example.com/same.png',
        };
        expect(countDistinctDriverDocs(duplicateThreeSlots)).toBe(1);
        expect(hasMinimumDriverDocs(duplicateThreeSlots)).toBe(false);
        expect(validateMinimumDriverDocs(duplicateThreeSlots)).toContain('duplicate document URLs');

        const threeDistinctWithOwnership = {
            dl_url: '/uploads/dl.jpg',
            rc_url: '/uploads/rc.jpg',
            ownership_url: '/uploads/owner.pdf',
        };
        expect(countDistinctDriverDocs(threeDistinctWithOwnership)).toBe(3);
        expect(hasMinimumDriverDocs(threeDistinctWithOwnership)).toBe(true);
        expect(validateMinimumDriverDocs(threeDistinctWithOwnership)).toBeNull();

        expect(getDriverDocCount({ documentCount: 3 })).toBe(3);
        expect(hasMinimumDriverDocs({ documentCount: 3 })).toBe(true);
        expect(getDriverDocCount({ documentCount: 99 })).toBe(5);
    });
});

describe('3-document minimum flows across AdminDriversView, ResubmitDocsView, DriverKycDocsCard, and VehicleDetailsScreen', () => {
    const originalPlatformOs = Platform.OS;
    let activeRenderer: renderer.ReactTestRenderer | null = null;

    beforeEach(() => {
        jest.clearAllMocks();
        mockAuthUser = null;
        (Platform as any).OS = originalPlatformOs;
        (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
            if (key === 'auth_token') return 'test-token';
            if (key === 'auth_refresh_token') return 'test-refresh';
            return null;
        });
    });

    afterEach(async () => {
        if (activeRenderer) {
            const toUnmount = activeRenderer;
            activeRenderer = null;
            await act(async () => {
                toUnmount.unmount();
            });
        }
        (Platform as any).OS = originalPlatformOs;
    });

    function setupAdminDriversFetch(drivers: Driver[]) {
        mockFetchWithAuth.mockImplementation(async (url: string, init?: RequestInit) => {
            if (url.endsWith('/api/admin/drivers') && (!init?.method || init.method === 'GET')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => drivers,
                };
            }
            if (url.includes('/api/admin/reviews/driver/')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ reviews: [], averageRating: 0, totalReviews: 0 }),
                };
            }
            if (url.includes('/verify') && init?.method === 'POST') {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ message: 'Updated' }),
                };
            }
            return {
                ok: false,
                status: 404,
                json: async () => ({ error: 'Not found' }),
            };
        });
    }

    test('AdminDriversView disables Approve when driver has < 3 docs or duplicate URLs', async () => {
        const drivers: Driver[] = [
            {
                id: 'drv-2',
                name: 'Two Doc Driver',
                phone: '9000000002',
                verificationStatus: 'pending',
                vehicleName: 'Swift Dzire',
                vehicleNumber: 'UK07AB1234',
                dlUrl: '/uploads/dl.png',
                rcUrl: '/uploads/rc.png',
            },
            {
                id: 'drv-dup',
                name: 'Dup URL Driver',
                phone: '9000000005',
                verificationStatus: 'pending',
                vehicleName: 'Innova',
                vehicleNumber: 'UK07CD5678',
                dlUrl: '/uploads/dup.png',
                rcUrl: '/uploads/dup.png',
                pollutionUrl: '/uploads/dup.png',
            },
        ];
        setupAdminDriversFetch(drivers);

        let tree!: renderer.ReactTestRenderer;
        await act(async () => {
            tree = renderer.create(<AdminDriversView token="admin-token" />);
            activeRenderer = tree;
            await flushMicrotasks();
        });

        expect(flattenText(tree.root.findByProps({ testID: 'driver-doc-count-drv-2' }))).toContain('2/5 Docs · Needs 3');
        expect(flattenText(tree.root.findByProps({ testID: 'driver-doc-count-drv-dup' }))).toContain('1/5 Docs · Needs 3');

        const inspectBtns = tree.root.findAll(
            (n) => typeof n.props?.onPress === 'function' && flattenText(n).includes('Inspect'),
        );
        expect(inspectBtns.length).toBeGreaterThanOrEqual(2);

        await act(async () => {
            inspectBtns[0].props.onPress();
            await flushMicrotasks();
        });

        const warningBanner = tree.root.findByProps({ testID: 'admin-verify-min-docs-warning' });
        expect(flattenText(warningBanner)).toContain('At least 3 distinct documents');

        const approveBtn = tree.root.findByProps({ testID: 'admin-inspect-approve-btn' });
        expect(approveBtn.props.disabled).toBe(true);

        const verifyCalls = mockFetchWithAuth.mock.calls.filter(([u]) => String(u).includes('/verify'));
        expect(verifyCalls).toHaveLength(0);

        activeRenderer = null;
        await act(async () => {
            tree.unmount();
        });
    });

    test('AdminDriversView enables Approve for pending and rejected drivers with >= 3 distinct docs', async () => {
        const drivers: Driver[] = [
            {
                id: 'drv-3-pending',
                name: 'Three Doc Pending',
                phone: '9000000003',
                verificationStatus: 'pending',
                vehicleName: 'Ertiga',
                vehicleNumber: 'UK07EF1111',
                dlUrl: '/uploads/dl.png',
                rcUrl: '/uploads/rc.png',
                ownershipUrl: '/uploads/owner.pdf',
            },
            {
                id: 'drv-3-rejected',
                name: 'Three Doc Rejected',
                phone: '9000000004',
                verificationStatus: 'rejected',
                rejectionReason: 'Earlier photo unclear',
                vehicleName: 'Bolero',
                vehicleNumber: 'UK07GH2222',
                dlUrl: '/uploads/dl2.png',
                rcUrl: '/uploads/rc2.png',
                pollutionUrl: '/uploads/puc2.png',
            },
        ];
        setupAdminDriversFetch(drivers);

        let tree!: renderer.ReactTestRenderer;
        await act(async () => {
            tree = renderer.create(<AdminDriversView token="admin-token" />);
            activeRenderer = tree;
            await flushMicrotasks();
        });

        expect(flattenText(tree.root.findByProps({ testID: 'driver-doc-count-drv-3-pending' }))).toContain('3/5 Docs · Ready');
        expect(flattenText(tree.root.findByProps({ testID: 'driver-doc-count-drv-3-rejected' }))).toContain('3/5 Docs · Ready');

        const inspectBtns = tree.root.findAll(
            (n) => typeof n.props?.onPress === 'function' && flattenText(n).includes('Inspect'),
        );

        // Open inspect for 3-doc pending driver (missing PUC & Photo)
        await act(async () => {
            inspectBtns[0].props.onPress();
            await flushMicrotasks();
        });

        expect(tree.root.findAllByProps({ testID: 'admin-verify-min-docs-warning' })).toHaveLength(0);
        expect(flattenText(tree.root)).toContain('Not uploaded (optional once 3+ docs provided)');

        const pendingApproveBtn = tree.root.findByProps({ testID: 'admin-inspect-approve-btn' });
        expect(pendingApproveBtn.props.disabled).toBe(false);

        await act(async () => {
            await pendingApproveBtn.props.onPress();
            await flushMicrotasks();
        });

        const firstVerifyCall = mockFetchWithAuth.mock.calls.find(([u]) =>
            String(u).includes('/api/admin/drivers/drv-3-pending/verify'),
        );
        expect(firstVerifyCall).toBeDefined();
        expect(JSON.parse(firstVerifyCall![1].body as string)).toEqual({ status: 'verified', reason: '' });

        // Inspect rejected driver who now has 3 docs -> approve transition rejected -> verified
        const inspectBtnsAfter = tree.root.findAll(
            (n) => typeof n.props?.onPress === 'function' && flattenText(n).includes('Inspect'),
        );
        const rejectedInspectBtn = inspectBtnsAfter[inspectBtnsAfter.length - 1];
        await act(async () => {
            rejectedInspectBtn.props.onPress();
            await flushMicrotasks();
        });

        const rejectedApproveBtn = tree.root.findByProps({ testID: 'admin-inspect-approve-btn' });
        expect(rejectedApproveBtn.props.disabled).toBe(false);

        await act(async () => {
            await rejectedApproveBtn.props.onPress();
            await flushMicrotasks();
        });

        const secondVerifyCall = mockFetchWithAuth.mock.calls.find(([u]) =>
            String(u).includes('/api/admin/drivers/drv-3-rejected/verify'),
        );
        expect(secondVerifyCall).toBeDefined();
        expect(JSON.parse(secondVerifyCall![1].body as string)).toEqual({ status: 'verified', reason: '' });

        activeRenderer = null;
        await act(async () => {
            tree.unmount();
        });
    });

    test('DriverKycDocsCard shows duplicate warning cleanly when URLs repeat', async () => {
        let tree!: renderer.ReactTestRenderer;
        await act(async () => {
            tree = renderer.create(
                <DriverKycDocsCard
                    vehicleDocs={{
                        dl: '/uploads/shared.png',
                        rc: '/uploads/shared.png',
                        pollution: '/uploads/shared.png',
                    }}
                    onUpload={jest.fn()}
                    isDark={false}
                    primaryColor="#3B7DDD"
                    textColor="#111827"
                />,
            );
            activeRenderer = tree;
        });

        expect(flattenText(tree.root.findByProps({ testID: 'driver-docs-count-pill' }))).toBe('1/5');
        expect(flattenText(tree.root.findByProps({ testID: 'driver-docs-duplicate-warning' }))).toContain('Duplicate file URL');

        activeRenderer = null;
        await act(async () => {
            tree.unmount();
        });
    });

    test('ResubmitDocsView blocks < 3 docs and submits PUT /api/user/profile once 3 distinct docs are uploaded', async () => {
        (Platform as any).OS = 'web';
        mockPickAndUploadDocument.mockResolvedValue('/uploads/ownership-proof.jpg');
        mockApiRequest.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
        mockAuthUser = {
            id: 'drv-user-1',
            name: 'Karan Negi',
            phone_number: '9876543210',
            role: 'driver',
            verification_status: 'rejected',
            vehicle: {
                vehicle_name: 'Mahindra Scorpio',
                vehicle_type: 'SUV',
                seats: 6,
                vehicle_number: 'UK07XY9999',
                dl_url: ' /uploads/dl.jpg ',
                rc_url: '/uploads/rc.jpg',
                pollution_url: '',
                vehicle_image_url: '',
                ownership_url: '',
                seating_layout: 'suv',
            },
        };

        let tree!: renderer.ReactTestRenderer;
        await act(async () => {
            tree = renderer.create(<ResubmitDocsView onClose={jest.fn()} disableBrowserBack />);
            activeRenderer = tree;
            await flushMicrotasks();
        });

        expect(flattenText(tree.root.findByProps({ testID: 'driver-docs-progress' }))).toContain('2/5 uploaded');

        const findSubmitBtn = () => {
            const btns = tree.root.findAll(
                (n) => typeof n.props?.onPress === 'function' && flattenText(n).includes('Resubmit Documents'),
            );
            return btns[btns.length - 1];
        };

        // Try submitting with 2 docs -> blocked with notify error
        await act(async () => {
            await findSubmitBtn().props.onPress();
            await flushMicrotasks();
        });
        expect(mockNotify).toHaveBeenCalledWith(
            'common.error',
            expect.stringContaining('at least 3 distinct'),
        );
        expect(mockApiRequest).not.toHaveBeenCalled();

        // Upload 3rd distinct doc (Ownership Proof) -> progress hits 3/5 and submit succeeds
        await act(async () => {
            tree.root.findByProps({ testID: 'driver-doc-row-ownership' }).props.onPress();
            await flushMicrotasks();
        });

        expect(flattenText(tree.root.findByProps({ testID: 'driver-docs-progress' }))).toContain('3/5 uploaded · Ready');

        await act(async () => {
            await findSubmitBtn().props.onPress();
            await flushMicrotasks();
        });

        expect(mockApiRequest).toHaveBeenCalledTimes(1);
        const [reqUrl, reqOpts] = mockApiRequest.mock.calls[0];
        expect(reqUrl).toBe('/api/user/profile');
        expect(reqOpts.method).toBe('PUT');
        const payload = JSON.parse(reqOpts.body);
        expect(payload.vehicle).toMatchObject({
            dl_url: '/uploads/dl.jpg',
            rc_url: '/uploads/rc.jpg',
            pollution_url: '',
            vehicle_image_url: '',
            ownership_url: '/uploads/ownership-proof.jpg',
        });
        expect(mockSetAuth).toHaveBeenCalledTimes(1);
        expect(flattenText(tree.root)).toContain('Documents Submitted!');

        activeRenderer = null;
        await act(async () => {
            tree.unmount();
        });
    });

    test('VehicleDetailsScreen displays uploaded count (3/5) and disables missing optional slots cleanly', async () => {
        mockAuthUser = {
            id: 'drv-user-2',
            name: 'Amit Bisht',
            phone_number: '9988776655',
            role: 'driver',
            verification_status: 'verified',
            vehicle: {
                vehicle_name: 'Toyota Innova',
                vehicle_type: 'SUV',
                seats: 7,
                vehicle_number: 'UK07ZZ4321',
                dl_url: '/uploads/dl.jpg',
                rc_url: '/uploads/rc.jpg',
                pollution_url: '/uploads/puc.jpg',
                vehicle_image_url: '',
                ownership_url: '',
                seating_layout: 'suv',
            },
        };

        let tree!: renderer.ReactTestRenderer;
        await act(async () => {
            tree = renderer.create(<VehicleDetailsScreen onBack={jest.fn()} />);
            activeRenderer = tree;
            await flushMicrotasks();
        });

        expect(flattenText(tree.root)).toContain('UPLOADED DOCUMENTS (3/5)');

        const dlRow = tree.root.findByProps({ testID: 'vehicle-doc-row-dl_url' });
        expect(dlRow.props.disabled).toBe(false);
        expect(flattenText(dlRow)).toContain('VIEW ›');

        const missingImgRow = tree.root.findByProps({ testID: 'vehicle-doc-row-vehicle_image_url' });
        expect(missingImgRow.props.disabled).toBe(true);
        expect(flattenText(missingImgRow)).toContain('Not uploaded');
        expect(flattenText(missingImgRow)).not.toContain('VIEW ›');

        const missingOwnerRow = tree.root.findByProps({ testID: 'vehicle-doc-row-ownership_url' });
        expect(missingOwnerRow.props.disabled).toBe(true);
        expect(flattenText(missingOwnerRow)).toContain('Not uploaded');

        activeRenderer = null;
        await act(async () => {
            tree.unmount();
        });
    });
});
