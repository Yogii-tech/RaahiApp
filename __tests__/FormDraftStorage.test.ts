import { saveFormDraft, loadFormDraft, clearFormDraft } from '../src/utils/formDraftStorage';

describe('FormDraftStorage Utility Tests', () => {
  const originalSessionStorage = window.sessionStorage;

  beforeEach(() => {
    let store: Record<string, string> = {};
    const mockStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };

    Object.defineProperty(window, 'sessionStorage', {
      value: mockStorage,
      writable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(window, 'sessionStorage', {
      value: originalSessionStorage,
      writable: true,
    });
  });

  test('should save and load form draft correctly', () => {
    const draftData = { pickup: 'Kotdwar', dropoff: 'Pauri', seats: 2 };
    saveFormDraft('test_route', draftData);

    const loaded = loadFormDraft('test_route', null);
    expect(loaded).toEqual(draftData);
  });

  test('should return fallback if draft key does not exist', () => {
    const fallback = { pickup: '', dropoff: '' };
    const loaded = loadFormDraft('non_existent_key', fallback);
    expect(loaded).toEqual(fallback);
  });

  test('should clear draft successfully', () => {
    saveFormDraft('temp_draft', { data: 123 });
    clearFormDraft('temp_draft');

    const loaded = loadFormDraft('temp_draft', null);
    expect(loaded).toBeNull();
  });
});
