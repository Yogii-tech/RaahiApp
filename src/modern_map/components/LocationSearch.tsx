/**
 * LocationSearch Component
 * ────────────────────────────────────────────────────────────
 * • Autocomplete input with debounced Nominatim search
 * • Keyboard navigation (↑↓ Enter Esc)
 * • "Use Current Location" shortcut
 * • Shows pickup + drop inputs
 * ────────────────────────────────────────────────────────────
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { searchPlaces, GeoResult } from '../services/geocoding';
import styles from './LocationSearch.module.css';

interface LocationSearchProps {
  placeholder: string;
  icon: 'pickup' | 'drop';
  value: string;
  onSelect: (result: GeoResult) => void;
  onUseCurrentLocation?: () => void;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function LocationSearch({
  placeholder, icon, value, onSelect, onUseCurrentLocation,
}: LocationSearchProps) {
  const [query, setQuery]         = useState(value);
  const [results, setResults]     = useState<GeoResult[]>([]);
  const [loading, setLoading]     = useState(false);
  const [focused, setFocused]     = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLUListElement>(null);

  const debouncedQuery = useDebounce(query, 350);

  useEffect(() => { setQuery(value); }, [value]);

  // ── Fetch suggestions ──
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    searchPlaces(debouncedQuery)
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  const handleSelect = useCallback((r: GeoResult) => {
    setQuery(r.display_name);
    setResults([]);
    setActiveIdx(-1);
    onSelect(r);
    inputRef.current?.blur();
  }, [onSelect]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(results[activeIdx]);
    } else if (e.key === 'Escape') {
      setResults([]);
      setActiveIdx(-1);
      inputRef.current?.blur();
    }
  };

  const showDropdown = focused && (results.length > 0 || loading);

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.inputRow} ${focused ? styles.focused : ''}`}>
        <span className={`${styles.dot} ${styles[icon]}`} />
        <input
          ref={inputRef}
          className={styles.input}
          placeholder={placeholder}
          value={query}
          onChange={e => { setQuery(e.target.value); setActiveIdx(-1); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        {loading && <span className={styles.spinner} />}
        {query && !loading && (
          <button
            className={styles.clearBtn}
            onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }}
            tabIndex={-1}
          >✕</button>
        )}
      </div>

      {showDropdown && (
        <ul ref={listRef} className={styles.dropdown}>
          {onUseCurrentLocation && query.length === 0 && (
            <li
              className={styles.item}
              onClick={onUseCurrentLocation}
            >
              <span className={styles.itemIcon}>📍</span>
              <span className={styles.itemText}>Use current location</span>
            </li>
          )}
          {results.map((r, i) => (
            <li
              key={r.place_id}
              className={`${styles.item} ${i === activeIdx ? styles.active : ''}`}
              onMouseDown={() => handleSelect(r)}
            >
              <span className={styles.itemIcon}>
                {icon === 'pickup' ? '🟢' : '🔴'}
              </span>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>
                  {r.display_name.split(',')[0]}
                </span>
                <span className={styles.itemSub}>
                  {r.display_name.split(',').slice(1, 3).join(',')}
                </span>
              </div>
            </li>
          ))}
          {results.length === 0 && !loading && query.length >= 3 && (
            <li className={`${styles.item} ${styles.noResult}`}>
              No results found for "{query}"
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
