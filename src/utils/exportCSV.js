export const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) {
    alert("Export ထုတ်ရန် မှတ်တမ်း မရှိပါ!");
    return;
  }

  // Header များကို ရယူခြင်း
  const headers = Object.keys(data[0]);

  // CSV format သို့ ပြောင်းလဲခြင်း
  const csvRows = [
    headers.join(','), // Header Row
    ...data.map(row => 
      headers.map(header => {
        let value = row[header];
        
        // Value မရှိလျှင် အလွတ်ထားရန်
        if (value === null || value === undefined) value = '';
        
        // Array သို့မဟုတ် Object ဖြစ်နေလျှင် String အဖြစ်ပြောင်းရန် (ဥပမာ - items တွေ)
        if (typeof value === 'object') {
          value = JSON.stringify(value).replace(/"/g, '""');
        } else {
          value = String(value).replace(/"/g, '""');
        }

        // ကော်မာ ပါနေလျှင် Quote ဖြင့်အုပ်ရန်
        if (value.includes(',') || value.includes('\n') || value.includes('"')) {
          return `"${value}"`;
        }
        return value;
      }).join(',')
    )
  ];

  const csvContent = csvRows.join('\n');
  
  // UTF-8 BOM ထည့်ပေးခြင်း (Excel တွင် မြန်မာစာ မှန်ကန်စွာ ပေါ်စေရန်)
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  
  // Auto Download ချပေးမည့် လင့်ခ် ဖန်တီးခြင်း
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
