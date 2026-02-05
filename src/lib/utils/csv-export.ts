 /**
  * Convert array of objects to CSV string
  */
 export function convertToCSV<T extends Record<string, unknown>>(
   data: T[],
   columns: { key: keyof T; header: string }[]
 ): string {
   if (data.length === 0) return '';
 
   // BOM for Excel UTF-8 compatibility
   const BOM = '\uFEFF';
   
   // Header row
   const headers = columns.map((col) => escapeCSVField(col.header)).join(',');
   
   // Data rows
   const rows = data.map((row) =>
     columns
       .map((col) => {
         const value = row[col.key];
         if (value === null || value === undefined) return '';
         return escapeCSVField(String(value));
       })
       .join(',')
   );
 
   return BOM + [headers, ...rows].join('\n');
 }
 
 /**
  * Escape special characters in CSV fields
  */
 function escapeCSVField(field: string): string {
   // If field contains comma, newline, or double quote, wrap in quotes
   if (field.includes(',') || field.includes('\n') || field.includes('"')) {
     // Escape double quotes by doubling them
     return `"${field.replace(/"/g, '""')}"`;
   }
   return field;
 }
 
 /**
  * Trigger download of CSV file
  */
 export function downloadCSV(csvContent: string, filename: string): void {
   const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
   const url = URL.createObjectURL(blob);
   
   const link = document.createElement('a');
   link.setAttribute('href', url);
   link.setAttribute('download', filename);
   link.style.visibility = 'hidden';
   
   document.body.appendChild(link);
   link.click();
   document.body.removeChild(link);
   
   URL.revokeObjectURL(url);
 }