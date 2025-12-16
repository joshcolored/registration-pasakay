'use client';

import { useEffect, useState } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { database } from '@/lib/firebase';
import { CheckCircle, XCircle, Image as ImageIcon } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';

type MerchantPaymentStatus = 'pending' | 'approved' | 'rejected';

interface MerchantPayment {
  paymentId: string;
  merchantId: string;
  merchantName: string;
  plan: 'oneMonth' | 'threeMonths';
  amount: number;
  receiptUrl?: string;
  status: MerchantPaymentStatus;
  createdAt: string;
}

export default function MerchantPaymentsPage() {
  const [payments, setPayments] = useState<MerchantPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    const paymentsRef = ref(database, 'merchant_subscription_payments');
    const unsub = onValue(paymentsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list: MerchantPayment[] = Object.keys(data)
          .map((key) => ({ paymentId: key, ...data[key] }))
          .filter((p) => p.status === 'pending');
        setPayments(list);
      } else {
        setPayments([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const updateStatus = async (payment: MerchantPayment, status: MerchantPaymentStatus) => {
    try {
      setProcessing(payment.paymentId);
      await update(ref(database, `merchant_subscription_payments/${payment.paymentId}`), {
        status,
        verifiedAt: new Date().toISOString(),
      });
      if (status === 'approved') {
        await update(ref(database, `merchants/${payment.merchantId}`), {
          hasActiveSubscription: true,
          subscriptionPlan: payment.plan,
          subscriptionExpiry: new Date(
            Date.now() + (payment.plan === 'oneMonth' ? 30 : 90) * 24 * 60 * 60 * 1000,
          ).toISOString(),
        });
      }
      alert(`Payment ${status}`);
    } catch (e) {
      console.error(e);
      alert('Failed to update payment');
    }
    setProcessing(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Merchant Subscription Payments</h1>
          <p className="text-gray-600">Review and approve merchant subscription proofs</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl bg-white">
            <p className="text-lg font-medium text-gray-900">No pending payments</p>
            <p className="text-gray-500">All merchant payments have been reviewed.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {payments.map((payment) => (
              <div
                key={payment.paymentId}
                className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-500">Merchant</p>
                    <p className="text-lg font-semibold text-gray-900">{payment.merchantName}</p>
                    <p className="text-sm text-gray-600">
                      Plan: {payment.plan === 'oneMonth' ? '1 Month' : '3 Months'}
                    </p>
                    <p className="text-sm text-gray-600">
                      Submitted: {new Date(payment.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-2xl font-bold text-purple-700">
                    ₱{payment.amount.toLocaleString('en-PH', { maximumFractionDigits: 0 })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  {payment.receiptUrl && (
                    <a
                      href={payment.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <ImageIcon className="w-4 h-4" />
                      View receipt
                    </a>
                  )}
                  <button
                    onClick={() => updateStatus(payment, 'approved')}
                    disabled={processing === payment.paymentId}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-60"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {processing === payment.paymentId ? 'Updating...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => updateStatus(payment, 'rejected')}
                    disabled={processing === payment.paymentId}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-60"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
