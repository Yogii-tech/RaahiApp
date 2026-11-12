import { Platform } from 'react-native';

/**
 * Generates a properly escaped CSV string from an array of row objects.
 */
export const generateCSV = (data: any[]): string => {
     if (data.length === 0) return '';

     // Get headers from the first object
     const headers = Object.keys(data[0]);
     const csvRows = [];

     // Add header row
     csvRows.push(headers.join(','));

     // Add data rows
     for (const row of data) {
          const values = headers.map(header => {
               const val = row[header];
               const escaped = String(val ?? '').replace(/"/g, '""');
               return `"${escaped}"`;
          });
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
          URL.revokeObjectURL(url);
     } else {
          // Fallback for mobile without dumping PII/financial CSV data to console
          if (typeof alert !== 'undefined') {
               alert('CSV Export is currently supported on Web.');
          }
     }
};
