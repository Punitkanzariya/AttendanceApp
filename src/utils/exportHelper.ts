import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

// ─── CSV EXPORT HELPER ───────────────────────────────────────────────────────
export async function exportToCSV(headers: string[], rows: string[][], filename: string): Promise<void> {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  if (Platform.OS === 'web') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    // Mobile file writing
    const fileUri = `${FileSystem.cacheDirectory}${filename}.csv`;
    await FileSystem.writeAsStringAsync(fileUri, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: `Export ${filename}`,
      UTI: 'public.comma-separated-values-text',
    });
  }
}

// ─── PDF EXPORT HELPER ───────────────────────────────────────────────────────
export async function exportToPDF(htmlContent: string, filename: string): Promise<void> {
  try {
    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    if (Platform.OS === 'web') {
      // expo-print printToFileAsync returns a local data uri or blob on web
      // We can trigger standard print directly
      await Print.printAsync({ html: htmlContent });
    } else {
      // Mobile sharing of PDF file
      const pdfUri = `${FileSystem.cacheDirectory}${filename}.pdf`;
      await FileSystem.moveAsync({
        from: uri,
        to: pdfUri,
      });
      await Sharing.shareAsync(pdfUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Export ${filename}`,
        UTI: 'com.adobe.pdf',
      });
    }
  } catch (error) {
    console.error('PDF Export failed:', error);
    throw new Error('Failed to generate PDF document');
  }
}

// ─── ATTENDANCE HTML TEMPLATE GENERATOR ──────────────────────────────────────
export function generateAttendanceHTML(
  title: string,
  subtitle: string,
  records: Array<{
    name: string;
    date: string;
    checkIn: string;
    checkOut: string;
    hours: string;
    status: string;
    verification: string;
  }>
): string {
  const rows = records.map(r => `
    <tr>
      <td>${r.name}</td>
      <td>${r.date}</td>
      <td style="color: ${r.status === 'Late' ? '#D97706' : '#1F2937'}">${r.checkIn}</td>
      <td>${r.checkOut}</td>
      <td style="font-weight: bold;">${r.hours}</td>
      <td>
        <span class="badge ${r.status === 'Late' ? 'bg-warning' : 'bg-success'}">
          ${r.status}
        </span>
      </td>
      <td>
        <span class="badge ${
          r.verification === 'Verified' ? 'bg-success' :
          r.verification === 'Rejected' ? 'bg-danger' : 'bg-pending'
        }">
          ${r.verification}
        </span>
      </td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1F2937; padding: 20px; line-height: 1.4; }
          h1 { font-size: 24px; color: #111827; margin-bottom: 4px; }
          p { font-size: 14px; color: #6B7280; margin-top: 0; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
          th { background-color: #F9FAFB; border-bottom: 2px solid #E5E7EB; text-align: left; padding: 12px; font-weight: bold; color: #374151; }
          td { border-bottom: 1px solid #E5E7EB; padding: 12px; }
          .badge { padding: 4px 8px; border-radius: 9999px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
          .bg-success { background-color: #D1FAE5; color: #065F46; }
          .bg-warning { background-color: #FEF3C7; color: #92400E; }
          .bg-danger { background-color: #FEE2E2; color: #991B1B; }
          .bg-pending { background-color: #F3F4F6; color: #374151; }
          .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #9CA3AF; border-top: 1px solid #E5E7EB; padding-top: 16px; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>${subtitle} &bull; Generated on ${new Date().toLocaleDateString()}</p>
        <table>
          <thead>
            <tr>
              <th>Employee Name</th>
              <th>Date</th>
              <th>Clock In</th>
              <th>Clock Out</th>
              <th>Total Hours</th>
              <th>Status</th>
              <th>Verification</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <div class="footer">
          Techsture HRM Attendance System &bull; Confidential Report
        </div>
      </body>
    </html>
  `;
}

// ─── EXPENSES HTML TEMPLATE GENERATOR ───────────────────────────────────────
export function generateExpensesHTML(
  title: string,
  subtitle: string,
  records: Array<{
    name: string;
    category: string;
    date: string;
    amount: string;
    description: string;
    status: string;
  }>
): string {
  const rows = records.map(r => `
    <tr>
      <td>${r.name}</td>
      <td style="font-weight: 600;">${r.category}</td>
      <td>${r.date}</td>
      <td style="font-weight: bold; color: #111827;">₹${r.amount}</td>
      <td>${r.description}</td>
      <td>
        <span class="badge ${
          r.status.startsWith('Approved') || r.status === 'Reimbursed' ? 'bg-success' :
          r.status === 'Rejected' ? 'bg-danger' : 'bg-warning'
        }">
          ${r.status}
        </span>
      </td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1F2937; padding: 20px; line-height: 1.4; }
          h1 { font-size: 24px; color: #111827; margin-bottom: 4px; }
          p { font-size: 14px; color: #6B7280; margin-top: 0; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
          th { background-color: #F9FAFB; border-bottom: 2px solid #E5E7EB; text-align: left; padding: 12px; font-weight: bold; color: #374151; }
          td { border-bottom: 1px solid #E5E7EB; padding: 12px; }
          .badge { padding: 4px 8px; border-radius: 9999px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
          .bg-success { background-color: #D1FAE5; color: #065F46; }
          .bg-warning { background-color: #FEF3C7; color: #92400E; }
          .bg-danger { background-color: #FEE2E2; color: #991B1B; }
          .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #9CA3AF; border-top: 1px solid #E5E7EB; padding-top: 16px; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>${subtitle} &bull; Generated on ${new Date().toLocaleDateString()}</p>
        <table>
          <thead>
            <tr>
              <th>Employee Name</th>
              <th>Category</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Description</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <div class="footer">
          Techsture HRM Attendance System &bull; Confidential Report
        </div>
      </body>
    </html>
  `;
}

// ─── LEAVES HTML TEMPLATE GENERATOR ──────────────────────────────────────────
export function generateLeavesHTML(
  title: string,
  subtitle: string,
  records: Array<{
    name: string;
    type: string;
    startDate: string;
    endDate: string;
    days: string;
    reason: string;
    status: string;
  }>
): string {
  const rows = records.map(r => `
    <tr>
      <td>${r.name}</td>
      <td style="font-weight: 600;">${r.type}</td>
      <td>${r.startDate} to ${r.endDate}</td>
      <td style="font-weight: bold;">${r.days}</td>
      <td>${r.reason}</td>
      <td>
        <span class="badge ${
          r.status === 'Approved' ? 'bg-success' :
          r.status === 'Rejected' ? 'bg-danger' : 'bg-warning'
        }">
          ${r.status}
        </span>
      </td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1F2937; padding: 20px; line-height: 1.4; }
          h1 { font-size: 24px; color: #111827; margin-bottom: 4px; }
          p { font-size: 14px; color: #6B7280; margin-top: 0; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
          th { background-color: #F9FAFB; border-bottom: 2px solid #E5E7EB; text-align: left; padding: 12px; font-weight: bold; color: #374151; }
          td { border-bottom: 1px solid #E5E7EB; padding: 12px; }
          .badge { padding: 4px 8px; border-radius: 9999px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
          .bg-success { background-color: #D1FAE5; color: #065F46; }
          .bg-warning { background-color: #FEF3C7; color: #92400E; }
          .bg-danger { background-color: #FEE2E2; color: #991B1B; }
          .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #9CA3AF; border-top: 1px solid #E5E7EB; padding-top: 16px; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>${subtitle} &bull; Generated on ${new Date().toLocaleDateString()}</p>
        <table>
          <thead>
            <tr>
              <th>Employee Name</th>
              <th>Leave Type</th>
              <th>Duration</th>
              <th>Total Days</th>
              <th>Reason</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <div class="footer">
          Techsture HRM Attendance System &bull; Confidential Report
        </div>
      </body>
    </html>
  `;
}

