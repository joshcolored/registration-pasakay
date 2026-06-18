'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle,
  Clock,
  Eye,
  Search,
  Wallet,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import PasakayLoader from '@/components/PasakayLoader';
import { auth } from '@/lib/firebase';
import { getStoredAdminSession } from '@/lib/adminSession';

type MembershipStatus = 'pending' | 'approved' | 'rejected';
type MembershipPlan = '1_month' | '3_months';

type MembershipPayment = {
  requestId: string;
  driverId: string;
  driverName: string;
  driverEmail?: string;
  driverPhone?: string;
  plan: string;
  planLabel?: string;
  amount?: number;
  paymentMethod?: string;
  paymentReference?: string;
  proofUrl?: string;
  proofPublicId?: string;
  proofDataUrl?: string;
  proofFileName?: string;
  proofContentType?: string;
  proofSize?: number;
  status: MembershipStatus;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  membership_expires_at?: string;
};

const planDetails: Record<MembershipPlan, { label: string; flutterPlan: string; days: number }> = {
  '1_month': { label: '1 Month', flutterPlan: 'oneMonth', days: 30 },
  '3_months': { label: '3 Months', flutterPlan: 'threeMonths', days: 90 },
};

const normalizePlan = (plan: string): MembershipPlan | null => {
  if (plan === '1_month' || plan === 'oneMonth') return '1_month';
  if (plan === '3_months' || plan === 'threeMonths') return '3_months';
  return null;
};

const formatDate = (value?: string | number | null) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function DriverMembershipsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<MembershipPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | MembershipStatus>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<MembershipPayment | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [proofViewer, setProofViewer] = useState<{
    dataUrl: string;
    fileName?: string;
    contentType?: string;
  } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const getAdminToken = () =>
    new Promise<string | null>((resolve) => {
      if (auth.currentUser) {
        auth.currentUser.getIdToken().then(resolve).catch(() => resolve(null));
        return;
      }

      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        unsubscribe();
        if (!currentUser) {
          resolve(null);
          return;
        }
        currentUser.getIdToken().then(resolve).catch(() => resolve(null));
      });
    });

  useEffect(() => {
    const adminUser = getStoredAdminSession();
    if (!adminUser) {
      router.push('/pasakay/login');
      return;
    }

    let mounted = true;
    let refreshId: ReturnType<typeof setInterval> | null = null;

    const loadPayments = async () => {
      try {
        const token = await getAdminToken();
        if (!token) {
          router.push('/pasakay/login?expired=1');
          return;
        }

        const response = await fetch('/api/admin/driver-memberships', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || 'Unable to load membership requests.');
        }

        if (mounted) {
          setPayments(Array.isArray(data.payments) ? data.payments : []);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading driver membership payments:', error);
        if (mounted) setLoading(false);
      }
    };

    loadPayments();
    refreshId = setInterval(loadPayments, 10000);

    return () => {
      mounted = false;
      if (refreshId) clearInterval(refreshId);
    };
  }, [router, refreshKey]);

  const filteredPayments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return payments.filter((payment) => {
      const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
      const matchesQuery =
        !normalizedQuery ||
        payment.driverName?.toLowerCase().includes(normalizedQuery) ||
        payment.driverEmail?.toLowerCase().includes(normalizedQuery) ||
        payment.driverPhone?.toLowerCase().includes(normalizedQuery) ||
        payment.paymentReference?.toLowerCase().includes(normalizedQuery) ||
        payment.requestId?.toLowerCase().includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [payments, query, statusFilter]);

  const stats = useMemo(
    () => ({
      total: payments.length,
      pending: payments.filter((payment) => payment.status === 'pending').length,
      approved: payments.filter((payment) => payment.status === 'approved').length,
      rejected: payments.filter((payment) => payment.status === 'rejected').length,
      revenue: payments
        .filter((payment) => payment.status === 'approved')
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    }),
    [payments]
  );

  const statCards: Array<{ label: string; value: string | number; icon: LucideIcon }> = [
    { label: 'Total', value: stats.total, icon: BadgeCheck },
    { label: 'Pending', value: stats.pending, icon: Clock },
    { label: 'Approved', value: stats.approved, icon: CheckCircle },
    { label: 'Rejected', value: stats.rejected, icon: XCircle },
    { label: 'Approved Revenue', value: `PHP ${stats.revenue.toLocaleString()}`, icon: Wallet },
  ];

  const approvePayment = async (payment: MembershipPayment) => {
    const normalizedPlan = normalizePlan(payment.plan);
    if (!normalizedPlan) {
      alert(`Unsupported membership plan: ${payment.plan}`);
      return;
    }

    if (!confirm(`Approve ${payment.driverName}'s ${planDetails[normalizedPlan].label} membership?`)) return;

    setProcessingId(payment.requestId);
    try {
      const token = await getAdminToken();
      if (!token) {
        router.push('/pasakay/login?expired=1');
        return;
      }

      const response = await fetch('/api/admin/driver-memberships', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'approve',
          requestId: payment.requestId,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to approve membership request.');
      }

      setRefreshKey((value) => value + 1);
    } catch (error) {
      console.error('Error approving driver membership:', error);
      alert(error instanceof Error ? error.message : 'Failed to approve membership request.');
    } finally {
      setProcessingId(null);
    }
  };

  const rejectPayment = async () => {
    if (!selectedPayment || !rejectionReason.trim()) {
      alert('Please provide a rejection reason.');
      return;
    }

    setProcessingId(selectedPayment.requestId);
    try {
      const token = await getAdminToken();
      if (!token) {
        router.push('/pasakay/login?expired=1');
        return;
      }

      const response = await fetch('/api/admin/driver-memberships', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'reject',
          requestId: selectedPayment.requestId,
          rejectionReason: rejectionReason.trim(),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to reject membership request.');
      }

      setSelectedPayment(null);
      setRejectionReason('');
      setRefreshKey((value) => value + 1);
    } catch (error) {
      console.error('Error rejecting driver membership:', error);
      alert(error instanceof Error ? error.message : 'Failed to reject membership request.');
    } finally {
      setProcessingId(null);
    }
  };

  const statusBadge = (status: MembershipStatus) => {
    const styles = {
      pending: 'bg-[#fff7df] text-[#9a6700] border-[#f1d58f]',
      approved: 'bg-[#e8f4f2] text-[#1f6f68] border-[#cfe4df]',
      rejected: 'bg-[#fff3f1] text-[#b42318] border-[#f0c2bd]',
    };

    return (
      <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-black capitalize ${styles[status]}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <PasakayLoader size="page" label="Loading memberships" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#1f6f68]">Driver memberships</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[#18211f]">Membership Approval Queue</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium text-[#66736f]">
              Review driver portal submissions and activate membership after PaSakay Admin approval.
            </p>
          </div>
          <div className="rounded-md border border-[#cfe4df] bg-[#eff8f5] px-4 py-3 text-sm font-black text-[#1f6f68]">
            Live updates enabled
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {statCards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-md border border-[#dfe5e1] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#66736f]">{label}</p>
                  <p className="mt-2 text-2xl font-black text-[#18211f]">{value}</p>
                </div>
                <Icon className="h-6 w-6 text-[#1f6f68]" />
              </div>
            </div>
          ))}
        </div>

        <div className="mb-6 grid gap-3 rounded-md border border-[#dfe5e1] bg-white p-4 shadow-sm md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#89918d]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search driver, email, phone, reference, or request ID"
              className="w-full rounded-md border border-[#dfe5e1] bg-white py-3 pl-10 pr-4 text-sm font-semibold outline-none focus:border-[#1f6f68]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | MembershipStatus)}
            className="rounded-md border border-[#dfe5e1] bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#1f6f68]"
          >
            <option value="all">All requests</option>
            <option value="pending">Pending only</option>
            <option value="approved">Approved only</option>
            <option value="rejected">Rejected only</option>
          </select>
        </div>

        <div className="overflow-hidden rounded-md border border-[#dfe5e1] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px]">
              <thead className="border-b border-[#dfe5e1] bg-[#f6f8f5]">
                <tr>
                  <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-[0.14em] text-[#66736f]">
                    Driver
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-[0.14em] text-[#66736f]">
                    Plan
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-[0.14em] text-[#66736f]">
                    Payment
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-[0.14em] text-[#66736f]">
                    Reference
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-[0.14em] text-[#66736f]">
                    Status
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-[0.14em] text-[#66736f]">
                    Submitted
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-[0.14em] text-[#66736f]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0eb]">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm font-semibold text-[#66736f]">
                      No membership requests found.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((payment) => {
                    const normalizedPlan = normalizePlan(payment.plan);
                    const proofUrl = payment.proofUrl || payment.proofDataUrl || '';
                    return (
                      <tr key={payment.requestId} className="hover:bg-[#f9faf7]">
                        <td className="px-5 py-4">
                          <p className="font-black text-[#18211f]">{payment.driverName}</p>
                          <p className="mt-1 text-xs font-semibold text-[#66736f]">{payment.driverEmail || 'No email'}</p>
                          <p className="mt-0.5 text-xs text-[#66736f]">{payment.driverPhone || payment.driverId}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-bold text-[#18211f]">
                            {normalizedPlan ? planDetails[normalizedPlan].label : payment.planLabel || payment.plan}
                          </p>
                          <p className="mt-1 text-xs text-[#66736f]">{payment.requestId}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-black text-[#1f6f68]">PHP {Number(payment.amount || 0).toLocaleString()}</p>
                          <p className="mt-1 text-xs font-bold uppercase text-[#66736f]">
                            {payment.paymentMethod || 'N/A'}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="max-w-44 truncate text-sm font-semibold text-[#18211f]">
                            {payment.paymentReference || 'N/A'}
                          </p>
                          {proofUrl && (
                            <button
                              onClick={() =>
                                setProofViewer({
                                  dataUrl: proofUrl,
                                  fileName: payment.proofFileName,
                                  contentType: payment.proofContentType,
                                })
                              }
                              className="mt-2 inline-flex items-center gap-1 rounded-md border border-[#dfe5e1] px-2 py-1 text-xs font-bold text-[#1f6f68] hover:bg-[#eff8f5]"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View proof
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {statusBadge(payment.status)}
                          {payment.rejectionReason && (
                            <p className="mt-2 max-w-44 text-xs font-semibold text-[#b42318]">
                              {payment.rejectionReason}
                            </p>
                          )}
                          {payment.membership_expires_at && (
                            <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-[#66736f]">
                              <CalendarDays className="h-3.5 w-3.5" />
                              Until {payment.membership_expires_at}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-[#49534f]">{formatDate(payment.createdAt)}</td>
                        <td className="px-5 py-4">
                          {payment.status === 'pending' ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => approvePayment(payment)}
                                disabled={processingId === payment.requestId}
                                className="inline-flex items-center gap-1 rounded-md bg-[#1f6f68] px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                              >
                                <CheckCircle className="h-4 w-4" />
                                Approve
                              </button>
                              <button
                                onClick={() => setSelectedPayment(payment)}
                                disabled={processingId === payment.requestId}
                                className="inline-flex items-center gap-1 rounded-md bg-[#b42318] px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                              >
                                <XCircle className="h-4 w-4" />
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-[#66736f]">
                              Reviewed {formatDate(payment.reviewedAt)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#18211f]/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-md border border-[#dfe5e1] bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-[#18211f]">Reject Membership Request</h2>
                <p className="mt-1 text-sm text-[#66736f]">{selectedPayment.driverName}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedPayment(null);
                  setRejectionReason('');
                }}
                className="rounded-md p-2 text-[#66736f] hover:bg-[#f6f8f5]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <textarea
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Rejection reason"
              rows={4}
              className="mt-4 w-full rounded-md border border-[#dfe5e1] p-3 text-sm font-semibold outline-none focus:border-[#1f6f68]"
            />
            <div className="mt-4 flex gap-3">
              <button
                onClick={rejectPayment}
                disabled={processingId === selectedPayment.requestId || !rejectionReason.trim()}
                className="flex-1 rounded-md bg-[#b42318] px-4 py-3 text-sm font-black text-white disabled:opacity-50"
              >
                Reject Request
              </button>
              <button
                onClick={() => {
                  setSelectedPayment(null);
                  setRejectionReason('');
                }}
                disabled={processingId === selectedPayment.requestId}
                className="flex-1 rounded-md border border-[#dfe5e1] px-4 py-3 text-sm font-black text-[#49534f] disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {proofViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#18211f]/70 p-4" onClick={() => setProofViewer(null)}>
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-md bg-white" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#dfe5e1] px-4 py-3">
              <div>
                <h2 className="font-black text-[#18211f]">Payment Proof</h2>
                {proofViewer.fileName && <p className="mt-1 text-xs font-semibold text-[#66736f]">{proofViewer.fileName}</p>}
              </div>
              <button onClick={() => setProofViewer(null)} className="rounded-md p-2 text-[#66736f] hover:bg-[#f6f8f5]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[76vh] overflow-auto bg-[#f6f8f5] p-4">
              {proofViewer.contentType === 'application/pdf' || proofViewer.dataUrl.startsWith('data:application/pdf') || proofViewer.dataUrl.toLowerCase().includes('.pdf') ? (
                <a
                  href={proofViewer.dataUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-md bg-[#1f6f68] px-4 py-3 font-black text-white"
                >
                  Open PDF proof
                </a>
              ) : (
                <img src={proofViewer.dataUrl} alt="Payment proof" className="mx-auto max-h-[70vh] rounded-md object-contain" />
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
