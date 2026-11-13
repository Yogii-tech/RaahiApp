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
    expect(output).toContain('"id","name","city"');
  });

  test('should collect union of keys across heterogeneous rows', () => {
    const output = generateCSV([
      { id: '1', name: 'Asha' },
      { id: '2', phone: '9999999999', role: 'driver' },
    ]);
    const lines = output.split('\n');
    expect(lines[0]).toBe('"id","name","phone","role"');
    expect(lines[1]).toBe('"1","Asha","",""');
    expect(lines[2]).toBe('"2","","9999999999","driver"');
  });

  test('should neutralize CSV formula injection prefixes', () => {
    const output = generateCSV([
      { a: '=CMD()', b: '+1+1', c: '-2+3', d: '@SUM(A1)', e: '\tcalc', f: '\rcmd' },
    ]);
    const dataLine = output.split('\n')[1];
    expect(dataLine).toBe(`"'=CMD()","'+1+1","'-2+3","'@SUM(A1)","'\tcalc","'\rcmd"`);
  });

  test('should defer URL.revokeObjectURL on web download', () => {
    jest.useFakeTimers();
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    const createObjectURL = jest.fn(() => 'blob:mock-url');
    const revokeObjectURL = jest.fn();
    (globalThis as any).URL = { ...(globalThis as any).URL, createObjectURL, revokeObjectURL };
    const clickMock = jest.fn();
    const linkMock = { setAttribute: jest.fn(), style: {} as any, click: clickMock };
    (globalThis as any).document = {
      createElement: jest.fn(() => linkMock),
      body: { appendChild: jest.fn(), removeChild: jest.fn() },
    };

    downloadCSV([{ id: '1' }], 'report');
    expect(clickMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    jest.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    jest.useRealTimers();
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
