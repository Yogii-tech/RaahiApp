import { downloadCSV } from '../src/utils/exportUtils';

describe('ExportUtils CSV Export Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle empty data without throwing', () => {
    expect(() => downloadCSV([], 'test')).not.toThrow();
  });

  test('should escape double quotes inside cell values', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const sampleData = [
      { id: '1', name: 'John "Rider" Doe', city: 'Kotdwar' }
    ];

    downloadCSV(sampleData, 'test_export');
    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls[0][1];
    expect(output).toContain('"John ""Rider"" Doe"');
    consoleSpy.mockRestore();
  });
});
