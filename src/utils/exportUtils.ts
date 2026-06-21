import { Platform } from 'react-native';

/**
 * Downloads a CSV file with the given data and filename.
 * @param data Array of objects representing the rows.
 * @param filename Desired filename for the download.
 */
export const downloadCSV = (data: any[], filename: string) => {
     if (data.length === 0) return;

     // Get headers from the first object
     const headers = Object.keys(data[0]);
     const csvRows = [];

     // Add header row
     csvRows.push(headers.join(','));

     // Add data rows
     for (const row of data) {
          const values = headers.map(header => {
               const val = row[header];
               const escaped = ('' + val).replace(/"/g, '\\"');
               return `"${escaped}"`;
          });
          csvRows.push(values.join(','));
     }

     const csvString = csvRows.join('\n');

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
     } else {
          // Fallback for mobile if needed (using Alert for now)
          console.log('CSV Data:', csvString);
          // In a real app we would use react-native-fs or expo-file-system
          alert('CSV Export is currently supported on Web. Data logged to console.');
     }
};
