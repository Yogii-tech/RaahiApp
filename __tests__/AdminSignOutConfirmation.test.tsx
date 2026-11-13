import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ActivityIndicator, Alert, Dimensions, Modal, Platform, Text } from 'react-native';

const mockLogout = jest.fn<Promise<void>, []>(async () => {});
const mockFetchWithAuth = jest.fn(async (url?: string) => {
  const data =
    typeof url === 'string' && url.includes('/api/notifications/unread-count')
      ? { unreadCount: 0 }
      : typeof url === 'string' && url.includes('/api/notifications/')
        ? []
        : {};
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(data),
    json: async () => data,
  };
});

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'admin-token',
    refreshToken: 'admin-refresh',
    user: { id: 'admin-1', name: 'Test Admin', phone_number: '9999999999', role: 'admin' },
    isAuthenticated: true,
    isInitialLoading: false,
    logout: mockLogout,
    setAuth: jest.fn(),
    tryRefreshToken: jest.fn(),
    fetchWithAuth: mockFetchWithAuth,
  }),
}));

jest.mock('../src/services/fcmService', () => ({
  registerFCM: jest.fn(async () => ({ permission: 'granted', tokenUploaded: true })),
  unregisterFCM: jest.fn(async () => undefined),
  getWebNotificationPermission: jest.fn(() => 'granted'),
}));

jest.mock('../src/utils/notify', () => ({
  notify: jest.fn(),
  confirmAction: jest.fn(),
}));

jest.mock('../src/components/RaahiLogo', () => () => null);
jest.mock('../src/screens/admin/AdminDashboardView', () => () => null);
jest.mock('../src/screens/admin/AdminBookingsView', () => () => null);
jest.mock('../src/screens/admin/AdminDriversView', () => () => null);
jest.mock('../src/screens/admin/AdminRidesDetailView', () => () => null);
jest.mock('../src/screens/admin/AdminParcelsDetailView', () => () => null);
jest.mock('../src/screens/admin/AdminVisitorsDetailView', () => () => null);
jest.mock('../src/screens/admin/AdminRoutesDetailView', () => () => null);
jest.mock('../src/screens/admin/AdminReportsView', () => () => null);
jest.mock('../src/screens/admin/AdminVehiclesView', () => () => null);
jest.mock('../src/screens/admin/AdminFinanceView', () => () => null);
jest.mock('../src/screens/admin/AdminAuditLogsView', () => () => null);

import AdminDashboardScreen from '../src/screens/admin/AdminDashboardScreen';
import AdminSettingsView from '../src/screens/admin/AdminSettingsView';
import SignOutConfirmModal from '../src/screens/admin/SignOutConfirmModal';
import { confirmAction } from '../src/utils/notify';

const findPressableByTestId = (
  root: ReactTestRenderer.ReactTestInstance,
  testID: string,
) => {
  const matches = root.findAll(
    node => node.props?.testID === testID && typeof node.props?.onPress === 'function',
  );
  if (matches.length === 0) {
    throw new Error(`No pressable node found with testID="${testID}"`);
  }
  return matches[0];
};

const queryByTestId = (
  root: ReactTestRenderer.ReactTestInstance,
  testID: string,
) => root.findAll(node => node.props?.testID === testID);

const collectText = (root: ReactTestRenderer.ReactTestInstance) =>
  root
    .findAllByType(Text)
    .map(node => {
      const children = node.props.children;
      if (Array.isArray(children)) return children.join('');
      return children == null ? '' : String(children);
    })
    .join(' ');

describe('Admin Sign Out Confirmation Modal', () => {
  const originalOS = Platform.OS;
  let activeRenderer: ReactTestRenderer.ReactTestRenderer | null = null;

  const setViewportWidth = (width: number) => {
    jest.spyOn(Dimensions, 'get').mockReturnValue({
      width,
      height: 800,
      scale: 1,
      fontScale: 1,
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogout.mockImplementation(async () => {});
    setViewportWidth(1280);
  });

  afterEach(async () => {
    if (activeRenderer) {
      const toUnmount = activeRenderer;
      activeRenderer = null;
      await act(async () => {
        toUnmount.unmount();
      });
    }
    jest.restoreAllMocks();
    Object.defineProperty(Platform, 'OS', {
      value: originalOS,
      configurable: true,
    });
  });

  test('AdminDashboardScreen sidebar Sign Out opens themed Modal instead of immediate logout and handles Cancel, backdrop, and onRequestClose', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(<AdminDashboardScreen />);
      activeRenderer = renderer;
    });

    // Modal should be closed initially
    expect(queryByTestId(renderer.root, 'admin-signout-confirm-btn')).toHaveLength(0);
    expect(mockLogout).not.toHaveBeenCalled();

    // Clicking sidebar Sign Out opens confirmation modal without calling logout
    await act(async () => {
      findPressableByTestId(renderer.root, 'admin-sidebar-signout-btn').props.onPress();
    });

    expect(mockLogout).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(confirmAction).not.toHaveBeenCalled();
    expect(queryByTestId(renderer.root, 'admin-signout-confirm-btn').length).toBeGreaterThan(0);

    const modalText = collectText(renderer.root);
    expect(modalText).toContain('Sign Out?');
    expect(modalText).toContain('Do you really want to logout');
    expect(modalText).toContain('No');
    expect(modalText).toContain('Yes, Sign Out');

    // Clicking "No" closes the modal without signing out
    await act(async () => {
      findPressableByTestId(renderer.root, 'admin-signout-cancel-btn').props.onPress();
    });
    expect(mockLogout).not.toHaveBeenCalled();
    expect(queryByTestId(renderer.root, 'admin-signout-confirm-btn')).toHaveLength(0);

    // Re-open and dismiss via backdrop press
    await act(async () => {
      findPressableByTestId(renderer.root, 'admin-sidebar-signout-btn').props.onPress();
    });
    expect(queryByTestId(renderer.root, 'admin-signout-backdrop').length).toBeGreaterThan(0);

    await act(async () => {
      findPressableByTestId(renderer.root, 'admin-signout-backdrop').props.onPress();
    });
    expect(mockLogout).not.toHaveBeenCalled();
    expect(queryByTestId(renderer.root, 'admin-signout-confirm-btn')).toHaveLength(0);

    // Re-open and dismiss via Modal onRequestClose (Android back / Web Escape)
    await act(async () => {
      findPressableByTestId(renderer.root, 'admin-sidebar-signout-btn').props.onPress();
    });
    const modal = renderer.root.findByType(Modal);
    await act(async () => {
      modal.props.onRequestClose();
    });
    expect(mockLogout).not.toHaveBeenCalled();
    expect(queryByTestId(renderer.root, 'admin-signout-confirm-btn')).toHaveLength(0);

    // Confirming "Yes, Sign Out" calls logout once
    await act(async () => {
      findPressableByTestId(renderer.root, 'admin-sidebar-signout-btn').props.onPress();
    });
    await act(async () => {
      await findPressableByTestId(renderer.root, 'admin-signout-confirm-btn').props.onPress();
    });
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(queryByTestId(renderer.root, 'admin-signout-confirm-btn')).toHaveLength(0);

    activeRenderer = null;
    await act(async () => {
      renderer.unmount();
    });
    alertSpy.mockRestore();
  });

  test('prevents double-trigger logout and blocks dismissal while async logout is in flight', async () => {
    let resolveLogout!: () => void;
    mockLogout.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveLogout = resolve;
        }),
    );

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<AdminDashboardScreen />);
      activeRenderer = renderer;
    });

    await act(async () => {
      findPressableByTestId(renderer.root, 'admin-sidebar-signout-btn').props.onPress();
    });

    // Rapid double-press before promise resolves
    await act(async () => {
      const confirmBtn = findPressableByTestId(renderer.root, 'admin-signout-confirm-btn');
      confirmBtn.props.onPress();
      confirmBtn.props.onPress();
    });

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(renderer.root.findAllByType(ActivityIndicator).length).toBeGreaterThan(0);
    expect(findPressableByTestId(renderer.root, 'admin-signout-cancel-btn').props.disabled).toBe(true);
    expect(findPressableByTestId(renderer.root, 'admin-signout-confirm-btn').props.disabled).toBe(true);
    expect(findPressableByTestId(renderer.root, 'admin-signout-backdrop').props.disabled).toBe(true);

    // Attempting onRequestClose or cancel while signing out should NOT dismiss the modal
    await act(async () => {
      renderer.root.findByType(Modal).props.onRequestClose();
      findPressableByTestId(renderer.root, 'admin-signout-cancel-btn').props.onPress();
    });
    expect(queryByTestId(renderer.root, 'admin-signout-confirm-btn').length).toBeGreaterThan(0);

    // Resolve logout cleanly
    await act(async () => {
      resolveLogout();
    });
    expect(queryByTestId(renderer.root, 'admin-signout-confirm-btn')).toHaveLength(0);

    activeRenderer = null;
    await act(async () => {
      renderer.unmount();
    });
  });

  test('AdminSettingsView Danger Zone Sign Out uses themed Modal on both Web and Native without Alert.alert or window.confirm', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'web',
      configurable: true,
    });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <AdminSettingsView isDark={true} activeTab="settings" />,
      );
    });

    // Click Danger Zone Sign Out button
    await act(async () => {
      findPressableByTestId(renderer.root, 'admin-settings-signout-btn').props.onPress();
    });

    expect(mockLogout).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(confirmAction).not.toHaveBeenCalled();
    expect(queryByTestId(renderer.root, 'admin-signout-confirm-btn').length).toBeGreaterThan(0);

    // Cancel first
    await act(async () => {
      findPressableByTestId(renderer.root, 'admin-signout-cancel-btn').props.onPress();
    });
    expect(mockLogout).not.toHaveBeenCalled();
    expect(queryByTestId(renderer.root, 'admin-signout-confirm-btn')).toHaveLength(0);

    // Open again and confirm
    await act(async () => {
      findPressableByTestId(renderer.root, 'admin-settings-signout-btn').props.onPress();
    });
    await act(async () => {
      await findPressableByTestId(renderer.root, 'admin-signout-confirm-btn').props.onPress();
    });
    expect(mockLogout).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer.unmount();
    });
    alertSpy.mockRestore();
  });

  test('mobile AdminDashboardScreen drawer Sign Out asks for confirmation before calling logout', async () => {
    setViewportWidth(390);

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<AdminDashboardScreen />);
      activeRenderer = renderer;
    });

    // Open mobile sidebar drawer via hamburger button
    const hamburgerBtn = renderer.root.findAll(
      node =>
        typeof node.props?.onPress === 'function' &&
        node.findAllByType(Text).some(t => t.props.children === '☰'),
    )[0];
    expect(hamburgerBtn).toBeDefined();

    await act(async () => {
      hamburgerBtn.props.onPress();
    });

    // Tap Sign Out inside mobile drawer -> confirmation modal appears, logout not called yet
    await act(async () => {
      findPressableByTestId(renderer.root, 'admin-sidebar-signout-btn').props.onPress();
    });
    expect(mockLogout).not.toHaveBeenCalled();
    expect(queryByTestId(renderer.root, 'admin-signout-confirm-btn').length).toBeGreaterThan(0);

    // Confirm sign out
    await act(async () => {
      await findPressableByTestId(renderer.root, 'admin-signout-confirm-btn').props.onPress();
    });
    expect(mockLogout).toHaveBeenCalledTimes(1);

    activeRenderer = null;
    await act(async () => {
      renderer.unmount();
    });
  });

  test('SignOutConfirmModal renders cleanly in both dark and light themes', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <SignOutConfirmModal
          visible={true}
          isDark={false}
          onCancel={jest.fn()}
          onConfirm={jest.fn()}
        />,
      );
    });
    expect(collectText(renderer.root)).toContain('Sign Out?');

    await act(async () => {
      renderer.update(
        <SignOutConfirmModal
          visible={true}
          isDark={true}
          onCancel={jest.fn()}
          onConfirm={jest.fn()}
        />,
      );
    });
    expect(collectText(renderer.root)).toContain('Yes, Sign Out');

    activeRenderer = null;
    await act(async () => {
      renderer.unmount();
    });
  });
});
