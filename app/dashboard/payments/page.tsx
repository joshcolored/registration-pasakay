'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ref, onValue, update } from 'firebase/database';
import { database } from '@/lib/firebase';
import { createAdminNotification } from '@/lib/adminNotifications';
import { getStoredAdminSession } from '@/lib/adminSession';
import { Payment } from '@/types';
import { Search, CheckCircle, XCircle, Eye, Clock, DollarSign } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';

type PaymentStatus = 'pending' | 'approved' | 'rejected';

const normalizePaymentStatus = (status: string | undefined): PaymentStatus => {
  if (status === 'rejected') return 'rejected';
  if (status === 'approved' || status === 'verified') return 'approved';
  return 'pending';
};

const getPlanDurationMs = (plan: string): number => {
  if (plan === 'oneMonth' || plan === '1_month') {
    return 30 * 24 * 60 * 60 * 1000;
  }
  if (plan === 'threeMonths' || plan === '3_months') {
    return 90 * 24 * 60 * 60 * 1000;
  }
  return 0;
};

const normalizeFlutterPlan = (plan: string): string => {
  if (plan === 'oneMonth' || plan === '1_month') {
    return 'oneMonth';
  }
  if (plan === 'threeMonths' || plan === '3_months') {
    return 'threeMonths';
  }
  return plan;
};

export default function PaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | PaymentStatus>('all');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [imageViewerUrl, setImageViewerUrl] = useState<string | null>(null);

  useEffect(() => {
    // Check if admin is logged in
    const adminUser = getStoredAdminSession();
    if (!adminUser) {
      router.push('/pasakay/login');
      return;
    }

    // Set up real-time listener for payments
    const paymentsRef = ref(database, 'subscription_payments');
    
    const unsubscribe = onValue(paymentsRef, (snapshot) => {
      if (snapshot.exists()) {
        const paymentsData = snapshot.val();
        const paymentsList: Payment[] = [];

        Object.entries(paymentsData).forEach(([id, payment]: [string, any]) => {
          // Map Flutter field names to web-admin field names
          // Map plan name for display
          let planName = payment.planName || '';
          const planValue = payment.plan || '';
          if (!planName) {
            if (planValue === 'oneMonth' || planValue === '1_month') {
              planName = '1 Month Plan';
            } else if (planValue === 'threeMonths' || planValue === '3_months') {
              planName = '3 Months Plan';
            } else if (planValue === 'freeTrial' || planValue === 'free_trial') {
              planName = 'N/A';
            } else {
              planName = planValue || 'N/A';
            }
          }
          
          const mappedStatus = normalizePaymentStatus(payment.status);
          
          paymentsList.push({
            ...payment,
            paymentId: id,
            // Map driver info
            userId: payment.userId || payment.driverId || '',
            driverName: payment.driverName || 'N/A',
            driverPhone: payment.driverPhone || 'N/A',
            // Map plan info
            plan: payment.plan || '',
            planName: planName,
            amount: payment.amount || 0,
            // Map receipt URL
            receiptImageUrl: payment.receiptImageUrl || payment.receiptUrl || '',
            // Map payment method
            paymentMethod: payment.paymentMethod || 'gcash',
            // Map status
            status: mappedStatus,
            // Map date - handle ISO string or timestamp
            timestamp: Number(payment.timestamp) || (payment.createdAt ? new Date(payment.createdAt).getTime() : Date.now()),
            submittedAt: payment.submittedAt || (payment.createdAt ? new Date(payment.createdAt).toLocaleString() : ''),
            // Verification info
            verifiedAt: payment.verifiedAt ? (typeof payment.verifiedAt === 'string' ? new Date(payment.verifiedAt).getTime() : payment.verifiedAt) : undefined,
            verifiedBy: payment.verifiedBy || '',
            rejectionReason: payment.rejectionReason || '',
          });
        });

        // Sort by timestamp (newest first)
        paymentsList.sort((a, b) => b.timestamp - a.timestamp);

        setPayments(paymentsList);
      } else {
        setPayments([]);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error loading payments:', error);
      setLoading(false);
    });

    // Cleanup listener on unmount
    return () => {
      unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    let filtered = payments;

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(payment => payment.status === filterStatus);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(payment =>
        payment.driverName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.driverPhone?.includes(searchQuery) ||
        payment.planName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.paymentId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.userId?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredPayments(filtered);
  }, [searchQuery, filterStatus, payments]);

  const handleApprove = async (payment: Payment) => {
    if (!confirm(`Approve payment from ${payment.driverName}?`)) return;

    setProcessing(true);
    try {
      const adminUser = getStoredAdminSession();
      if (!adminUser) {
        router.push('/pasakay/login?expired=1');
        return;
      }
      const now = Date.now();

      // Calculate subscription dates based on plan
      const subscriptionDuration = getPlanDurationMs(payment.plan);
      const normalizedPlan = normalizeFlutterPlan(payment.plan);

      if (!subscriptionDuration || (normalizedPlan !== 'oneMonth' && normalizedPlan !== 'threeMonths')) {
        alert(`Unsupported subscription plan: ${payment.plan}`);
        setProcessing(false);
        return;
      }

      const subscriptionStartDate = now;
      const subscriptionEndDate = now + subscriptionDuration;
      const subscriptionExpiryIso = new Date(subscriptionEndDate).toISOString();

      const updates: any = {};

      // Update payment record
      updates[`subscription_payments/${payment.paymentId}/status`] = 'approved';
      updates[`subscription_payments/${payment.paymentId}/verifiedBy`] = adminUser.userId;
      updates[`subscription_payments/${payment.paymentId}/verifiedAt`] = now;

      // Update driver subscription
      updates[`drivers/${payment.userId}/subscriptionStartDate`] = subscriptionStartDate;
      updates[`drivers/${payment.userId}/subscriptionEndDate`] = subscriptionEndDate;
      updates[`drivers/${payment.userId}/subscriptionStatus`] = 'active';
      updates[`drivers/${payment.userId}/subscriptionType`] = normalizedPlan;
      updates[`drivers/${payment.userId}/subscriptionPlan`] = normalizedPlan;
      updates[`drivers/${payment.userId}/subscriptionExpiry`] = subscriptionExpiryIso;
      updates[`drivers/${payment.userId}/hasActiveSubscription`] = true;

      await update(ref(database), updates);

      await createAdminNotification({
        title: 'Payment Approved',
        message: `${payment.driverName}'s ${payment.planName || payment.plan} payment was approved.`,
        type: 'paymentVerified',
        relatedId: payment.paymentId,
      });

      alert('Payment approved successfully!');
    } catch (error) {
      console.error('Error approving payment:', error);
      alert('Failed to approve payment');
    }
    setProcessing(false);
  };

  const handleReject = async () => {
    if (!selectedPayment || !rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    setProcessing(true);
    try {
      const adminUser = getStoredAdminSession();
      if (!adminUser) {
        router.push('/pasakay/login?expired=1');
        return;
      }
      const now = Date.now();

      const updates: any = {};

      // Update payment record
      updates[`subscription_payments/${selectedPayment.paymentId}/status`] = 'rejected';
      updates[`subscription_payments/${selectedPayment.paymentId}/rejectionReason`] = rejectionReason;
      updates[`subscription_payments/${selectedPayment.paymentId}/verifiedBy`] = adminUser.userId;
      updates[`subscription_payments/${selectedPayment.paymentId}/verifiedAt`] = now;

      await update(ref(database), updates);

      await createAdminNotification({
        title: 'Payment Rejected',
        message: `${selectedPayment.driverName}'s ${selectedPayment.planName || selectedPayment.plan} payment was rejected.`,
        type: 'paymentRejected',
        relatedId: selectedPayment.paymentId,
      });

      alert('Payment rejected');
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedPayment(null);
    } catch (error) {
      console.error('Error rejecting payment:', error);
      alert('Failed to reject payment');
    }
    setProcessing(false);
  };

  const openRejectModal = (payment: Payment) => {
    setSelectedPayment(payment);
    setShowRejectModal(true);
  };

  const viewReceipt = (url: string) => {
    if (!url) {
      alert('Receipt not available');
      return;
    }
    setImageViewerUrl(url);
  };

  const closeImageViewer = () => {
    setImageViewerUrl(null);
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const badges: any = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badges[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const calculateStats = () => {
    const totalRevenue = payments
      .filter(p => p.status === 'approved')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    return {
      totalRevenue,
      pendingCount: payments.filter(p => p.status === 'pending').length,
      approvedCount: payments.filter(p => p.status === 'approved').length,
      rejectedCount: payments.filter(p => p.status === 'rejected').length,
    };
  };

  const stats = calculateStats();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-black mb-2">Payment History</h1>
              <p className="text-black font-semibold">Review all driver subscription payments</p>
            </div>
            <div className="flex items-center space-x-2 bg-green-100 px-4 py-2 rounded-full">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <span className="text-green-700 font-semibold text-sm">Live Updates</span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-black text-sm font-bold mb-1">Total Payments</p>
                <p className="text-3xl font-bold text-black">{payments.length}</p>
              </div>
              <DollarSign className="w-12 h-12 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-black text-sm font-bold mb-1">Pending</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.pendingCount}</p>
              </div>
              <Clock className="w-12 h-12 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-black text-sm font-bold mb-1">Approved</p>
                <p className="text-3xl font-bold text-green-600">{stats.approvedCount}</p>
              </div>
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-black text-sm font-bold mb-1">Total Revenue</p>
                <p className="text-2xl font-bold text-purple-600">₱{stats.totalRevenue.toFixed(2)}</p>
              </div>
              <DollarSign className="w-12 h-12 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by driver name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-black font-semibold"
              />
            </div>

            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-black font-semibold"
              >
                <option value="all">All Payments</option>
                <option value="pending">Pending Only</option>
                <option value="approved">Approved Only</option>
                <option value="rejected">Rejected Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Payments Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-300">
                <tr>
                  <th className="text-left py-4 px-6 font-bold text-black">Driver</th>
                  <th className="text-left py-4 px-6 font-bold text-black">Plan</th>
                  <th className="text-left py-4 px-6 font-bold text-black">Amount</th>
                  <th className="text-left py-4 px-6 font-bold text-black">Payment Method</th>
                  <th className="text-left py-4 px-6 font-bold text-black">Receipt</th>
                  <th className="text-left py-4 px-6 font-bold text-black">Status</th>
                  <th className="text-left py-4 px-6 font-bold text-black">Date</th>
                  <th className="text-left py-4 px-6 font-bold text-black">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-black font-semibold">
                      No payments found
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((payment) => (
                    <tr key={payment.paymentId} className="border-b hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <div>
                          <p className="font-bold text-black">{payment.driverName || 'N/A'}</p>
                          <p className="text-sm text-gray-700 font-medium">{payment.driverPhone || 'N/A'}</p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-bold text-black">{payment.planName || 'N/A'}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-bold text-green-600">₱{payment.amount || 0}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                          {payment.paymentMethod?.toUpperCase() || 'N/A'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <button
                          onClick={() => viewReceipt(payment.receiptImageUrl || '')}
                          className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold hover:bg-purple-200 flex items-center space-x-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                      </td>
                      <td className="py-4 px-6">
                        {getStatusBadge(payment.status)}
                        {payment.status === 'rejected' && payment.rejectionReason && (
                          <p className="text-xs text-red-600 font-semibold mt-1">{payment.rejectionReason}</p>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-black font-semibold">{payment.submittedAt || formatDate(payment.timestamp)}</span>
                      </td>
                      <td className="py-4 px-6">
                        {payment.status === 'pending' && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleApprove(payment)}
                              disabled={processing}
                              className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center space-x-1"
                            >
                              <CheckCircle className="w-3 h-3" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => openRejectModal(payment)}
                              disabled={processing}
                              className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center space-x-1"
                            >
                              <XCircle className="w-3 h-3" />
                              <span>Reject</span>
                            </button>
                          </div>
                        )}
                        {payment.status === 'approved' && (
                          <span className="text-sm text-gray-500">
                            Approved {formatDate(payment.verifiedAt || 0)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Results Count */}
        <div className="mt-4 text-center text-gray-600">
          Showing {filteredPayments.length} of {payments.length} payments
        </div>
      </div>

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-black mb-4">Reject Payment</h3>
            <p className="text-black mb-4 font-medium">
              Driver: <span className="font-bold">{selectedPayment?.driverName}</span>
              <br />
              Amount: <span className="font-bold">₱{selectedPayment?.amount}</span>
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full px-4 py-2 border-2 border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none mb-4 text-black font-semibold placeholder-gray-400"
              rows={4}
            />
            <div className="flex space-x-3">
              <button
                onClick={handleReject}
                disabled={processing || !rejectionReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Reject'}
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                  setSelectedPayment(null);
                }}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-gray-300 text-black rounded-lg font-semibold hover:bg-gray-400 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {imageViewerUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={closeImageViewer}>
          <div className="relative max-w-4xl max-h-[90vh] mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-bold text-gray-800">Payment Receipt</h3>
                <button
                  onClick={closeImageViewer}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                >
                  &times;
                </button>
              </div>
              <div className="p-4 bg-gray-100">
                <img
                  src={imageViewerUrl}
                  alt="Payment Receipt"
                  className="max-w-full max-h-[70vh] mx-auto object-contain rounded-lg shadow-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="%23f3f4f6" width="400" height="300"/><text fill="%236b7280" font-family="Arial" font-size="16" x="50%" y="50%" text-anchor="middle" dy=".3em">Receipt not available</text></svg>';
                  }}
                />
              </div>
              <div className="p-4 border-t flex justify-between">
                <a
                  href={imageViewerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                >
                  Open in New Tab
                </a>
                <button
                  onClick={closeImageViewer}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
