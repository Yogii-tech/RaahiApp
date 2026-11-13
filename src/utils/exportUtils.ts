import { Platform } from 'react-native';

const FORMULA_INJECTION_RE = /^[=+\-@\t\r]/;

/**
 * Escapes a single CSV cell value against quote breaking and spreadsheet formula injection.
 */
const escapeCSVCell = (val: unknown): string => {
     const raw = String(val ?? '');
     const safe = FORMULA_INJECTION_RE.test(raw) ? `'${raw}` : raw;
     return `"${safe.replace(/"/g, '""')}"`;
};

/**
 * Generates a properly escaped CSV string from an array of row objects.
 * Collects the union of keys across all rows in encounter order.
 */
export const generateCSV = (data: any[]): string => {
     if (!Array.isArray(data) || data.length === 0) return '';

     const headers: string[] = [];
     const seen = new Set<string>();
     for (const row of data) {
          if (row && typeof row === 'object') {
               for (const key of Object.keys(row)) {
                    if (!seen.has(key)) {
                         seen.add(key);
                         headers.push(key);
                    }
               }
          }
     }
     if (headers.length === 0) return '';

     const csvRows = [headers.map(escapeCSVCell).join(',')];

     for (const row of data) {
          const values = headers.map(header => escapeCSVCell(row?.[header]));
          csvRows.push(values.join(','));
     }

     return csvRows.join('\n');
};

/**
 * Downloads a CSV file with the given data and filename.
 * @param data Array of objects representing the rows.
 * @param filename Desired filename for the download.
 */
export const downloadCSV = (data: any[], filename: string) => {
     const csvString = generateCSV(data);
     if (!csvString) return;

     if (Platform.OS === 'web') {
          const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.setAttribute('href', url);
          link.setAttribute('download', `${filename}.csv`);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
     } else {
          // Fallback for mobile without dumping PII/financial CSV data to console
          if (typeof alert !== 'undefined') {
               alert('CSV Export is currently supported on Web.');
          }
     }
};
