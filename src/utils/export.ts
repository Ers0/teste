// src/utils/csv.ts

/**
 * Converts an array of objects to a CSV string.
 * @param data The array of objects to convert.
 * @returns A CSV formatted string.
 */
function convertToCsv<T extends Record<string, any>>(data: T[]): string {
  if (data.length === 0) {
    return '';
  }

  const headers = Object.keys(data[0]);
  const csvRows = [];

  // Add header row
  csvRows.push(headers.join(','));

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      // Handle null/undefined, escape commas and double quotes
      if (value === null || value === undefined) {
        return '';
      }
      const stringValue = String(value);
      // If the value contains a comma, double quote, or newline, wrap it in double quotes
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

/**
 * Triggers a file download in the browser.
 * @param csvString The CSV data as a string.
 * @param filename The name of the file to download.
 */
export function downloadCsv(csvString: string, filename: string) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) { // Feature detection for download attribute
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // Clean up the URL object
  } else {
    // Fallback for browsers that don't support the download attribute
    window.open('data:text/csv;charset=utf-8,' + encodeURIComponent(csvString));
  }
}

/**
 * Fetches data and exports it to a CSV file.
 * @param data The array of objects to export.
 * @param filename The name of the CSV file.
 */
export function exportToCsv<T extends Record<string, any>>(data: T[], filename: string) {
  const csv = convertToCsv(data);
  downloadCsv(csv, filename);
}

/**
 * Parses a CSV string into an array of objects.
 * @param csvString The CSV string to parse.
 * @returns An array of objects.
 */
export function parseCsv<T extends Record<string, any>>(csvString: string): T[] {
  const lines = csvString.trim().split(/\r\n|\n/);
  if (lines.length < 2) {
    return []; // Not enough data (at least headers and one row)
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const data: T[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue; // Skip empty lines
    const values = lines[i].split(',');
    const obj: any = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[j] ? values[j].trim() : '';
    }
    data.push(obj as T);
  }

  return data;
}