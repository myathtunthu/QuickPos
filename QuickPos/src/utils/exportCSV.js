/**
 * Utility to export JSON data to a CSV file
 * @param {Array} data - Array of objects to export
 * @param {string} filename - Output filename (e.g., 'sales_report.csv')
 */
export const exportToCSV = (data, filename) => {
  if (!data || !data.length) {
    console.warn("No data available to export");
    return;
  }

  // Extract headers
  const headers = Object.keys(data[0]);
  
  // Build CSV string
  const csvRows = [];
  csvRows.push(headers.join(',')); // Add header row

  for (const row of data) {
    const values = headers.map(header => {
      const escaped = ('' + row[header]).replace(/"/g, '\\"');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  
  // Create download link
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
