import { Platform } from 'react-native';
import { downloadCSV, generateCSV } from '../src/utils/exportUtils';

describe('ExportUtils CSV Export Tests', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', {
      value: originalOS,
      configurable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', {
      value: originalOS,
      configurable: true,
    });
  });

  test('should handle empty data without throwing', () => {
    expect(generateCSV([])).toBe('');
    expect(() => downloadCSV([], 'test')).not.toThrow();
  });

  test('should escape double quotes inside cell values', () => {
    const sampleData = [
      { id: '1', name: 'John "Rider" Doe', city: 'Kotdwar' },
    ];

    const output = generateCSV(sampleData);
    expect(output).toContain('"John ""Rider"" Doe"');
    expect(output).toContain('id,name,city');
  });

  test('should alert on non-web platforms without logging CSV data to console', () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'ios',
      configurable: true,
    });
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const originalAlert = (globalThis as any).alert;
    const alertMock = jest.fn();
    (globalThis as any).alert = alertMock;

    downloadCSV([{ id: '1', name: 'John "Rider" Doe' }], 'test_export');

    expect(consoleSpy).not.toHaveBeenCalled();
    expect(alertMock).toHaveBeenCalledWith('CSV Export is currently supported on Web.');

    (globalThis as any).alert = originalAlert;
    consoleSpy.mockRestore();
  });
});
