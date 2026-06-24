export function formatDisplayStatus(status: string): string {
  switch (status) {
    case 'pending_coordinator':
      return 'Pending (Coordinator)';
    case 'pending_manager':
      return 'Pending (Manager)';
    case 'pending_hr':
      return 'Pending (HR)';
    case 'pending_finance':
      return 'Pending (Finance)';
    case 'pending':
    case 'pending_supervisor':
      return 'Pending';
    case 'approved':
    case 'reimbursed':
    case 'verified':
      return 'Approved'; // Or Verified
    case 'rejected':
      return 'Rejected';
    case 'draft':
      return 'Draft';
    default:
      return status
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
  }
}
