import Papa from 'papaparse';

/**
 * Parses a CSV file and returns a promise that resolves with an array of objects.
 * @param file The CSV file to parse.
 * @returns A promise that resolves with the parsed data.
 */
export const parseCsv = <T>(file: File): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse<T>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length) {
          const errorMessages = results.errors.map(e => e.message).join(', ');
          reject(new Error(`CSV parsing errors: ${errorMessages}`));
        } else {
          resolve(results.data);
        }
      },
      error: (error: Error) => {
        reject(error);
      },
    });
  });
};