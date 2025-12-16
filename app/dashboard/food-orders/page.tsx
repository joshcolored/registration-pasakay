'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { database } from '@/lib/firebase';
import { ref, onValue, off } from 'firebase/database';
import Link from 'next/link';
import {
  Truck,
  Wallet,
  Building2,
  DollarSign,
  Filter,
} from 'lucide-react';

type FoodOrder = {
  orderId: string;
  status: string;
  merchantName: string;
  customerName: string;
  deliveryFee: number;
  platformCommission: number;
  driverPayout: number;
  totalAmount: number;
  createdAt: number;
  deliveredAt?: number;
};

export default function FoodOrdersPage() {
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({});

  useEffect(() => {
    const ordersRef = ref(database, 'food_orders');
    const unsubscribe = onValue(
      ordersRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setOrders([]);
          setLoading(false);
          return;
        }
        const data = snapshot.val();
        const list: FoodOrder[] = [];
        Object.entries<any>(data).forEach(([id, value]) => {
          list.push({
            orderId: id,
            status: value.status || 'pending',
            merchantName: value.merchantName || 'N/A',
            customerName: value.customerName || 'N/A',
            deliveryFee: Number(value.deliveryFee || 0),
            platformCommission: Number(value.platformCommission || 0),
            driverPayout: Number(value.driverPayout || 0),
            totalAmount: Number(value.totalAmount || 0),
            createdAt: value.createdAt ? Date.parse(value.createdAt) : Date.now(),
            deliveredAt: value.deliveredAt ? Date.parse(value.deliveredAt) : undefined,
          });
        });
        // Newest first
        list.sort((a, b) => b.createdAt - a.createdAt);
        setOrders(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading food orders', err);
        setLoading(false);
      }
    );

    return () => off(ordersRef);
  }, []);

  const filtered = useMemo(() => {
    let list = orders;
    if (dateRange.start) {
      const startTs = Date.parse(dateRange.start);
      list = list.filter((o) => o.createdAt >= startTs);
    }
    if (dateRange.end) {
      const endTs = Date.parse(dateRange.end) + 24 * 60 * 60 * 1000;
      list = list.filter((o) => o.createdAt <= endTs);
    }
    return list;
  }, [orders, dateRange]);

  const delivered = filtered.filter((o) => o.status === 'delivered');
  const deliveredCount = delivered.length;
  const platformTotal = delivered.reduce((s, o) => s + o.platformCommission, 0);
  const payoutTotal = delivered.reduce((s, o) => s + o.driverPayout, 0);
  const deliveryFeeTotal = delivered.reduce((s, o) => s + o.deliveryFee, 0);

  const formatCurrency = (n: number) =>
    `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (ts?: number) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-blue-100 text-blue-800',
      preparing: 'bg-purple-100 text-purple-800',
      ready: 'bg-teal-100 text-teal-800',
      assigned: 'bg-cyan-100 text-cyan-800',
      pickedUp: 'bg-indigo-100 text-indigo-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return map[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Food Orders</h1>
            <p className="text-gray-600">Commission and payouts for delivered orders</p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center space-x-1"
          >
            <span>Back to Dashboard</span>
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-3 items-end">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">Filter by Date</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="text-xs text-gray-500">Start</label>
              <input
                type="date"
                value={dateRange.start || ''}
                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value || undefined }))}
                className="w-40 px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">End</label>
              <input
                type="date"
                value={dateRange.end || ''}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value || undefined }))}
                className="w-40 px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <button
              onClick={() => setDateRange({})}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            icon={<Truck className="w-5 h-5" />}
            label="Delivered Orders"
            value={deliveredCount.toString()}
            color="bg-blue-100 text-blue-800"
          />
          <SummaryCard
            icon={<Wallet className="w-5 h-5" />}
            label="Driver Payout"
            value={formatCurrency(payoutTotal)}
            color="bg-green-100 text-green-800"
          />
          <SummaryCard
            icon={<Building2 className="w-5 h-5" />}
            label="Platform Commission"
            value={formatCurrency(platformTotal)}
            color="bg-amber-100 text-amber-800"
          />
          <SummaryCard
            icon={<DollarSign className="w-5 h-5" />}
            label="Total Delivery Fee"
            value={formatCurrency(deliveryFeeTotal)}
            color="bg-purple-100 text-purple-800"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Order ID</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Merchant</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Customer</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Driver</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Delivery Fee</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Commission</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Payout</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Total</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Created</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Delivered</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-gray-500 text-sm">
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-gray-500 text-sm">
                    No orders found
                  </td>
                </tr>
              ) : (
                filtered.map((order) => (
                  <tr key={order.orderId} className="border-b hover:bg-gray-50 text-sm">
                    <td className="py-3 px-4 font-mono text-gray-800 break-all">{order.orderId}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusBadge(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-800">{order.merchantName}</td>
                    <td className="py-3 px-4 text-gray-600">{order.customerName}</td>
                    <td className="py-3 px-4 text-gray-600">{order.driverName || '—'}</td>
                    <td className="py-3 px-4 text-gray-800">{formatCurrency(order.deliveryFee)}</td>
                    <td className="py-3 px-4 text-gray-800">{formatCurrency(order.platformCommission)}</td>
                    <td className="py-3 px-4 text-gray-800">{formatCurrency(order.driverPayout)}</td>
                    <td className="py-3 px-4 text-gray-800">{formatCurrency(order.totalAmount)}</td>
                    <td className="py-3 px-4 text-gray-600">{formatDate(order.createdAt)}</td>
                    <td className="py-3 px-4 text-gray-600">{formatDate(order.deliveredAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className={`p-4 rounded-lg shadow bg-white border border-gray-100 flex items-start space-x-3`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );
}
