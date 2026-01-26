'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
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
  driverId?: string;
  driverName?: string;
  items: OrderItem[];
  specialInstructions?: string;
  subtotal: number;
  deliveryFee: number;
  platformCommission: number;
  driverPayout: number;
  totalAmount: number;
  createdAt: number;
  deliveredAt?: number;
};

type OrderItem = {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
  variantName?: string;
  variantPriceAdjustment?: number;
  addons?: { name?: string; price: number }[];
};

export default function FoodOrdersPage() {
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [driverNames, setDriverNames] = useState<Record<string, string>>({});
  const [menuItemImages, setMenuItemImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({});
  const [driverCommissionRate, setDriverCommissionRate] = useState(0.1);
  const [merchantCommissionRate, setMerchantCommissionRate] = useState(0.1);

  useEffect(() => {
    const ordersRef = ref(database, 'food_orders');
    const driversRef = ref(database, 'drivers');
    const menuItemsRef = ref(database, 'menu_items');
    const commissionRef = ref(database, 'settings/commission');

    const unsubscribeDrivers = onValue(
      driversRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setDriverNames({});
          return;
        }
        const data = snapshot.val();
        const map: Record<string, string> = {};
        Object.entries<any>(data).forEach(([id, value]) => {
          const name =
            value.driverName ||
            value.name ||
            value.fullName ||
            value.displayName ||
            value.userName ||
            value.profile?.name ||
            '';
          if (name) map[id] = name;
        });
        setDriverNames(map);
      },
      (err) => {
        console.error('Error loading drivers', err);
      }
    );

    const unsubscribeMenuItems = onValue(
      menuItemsRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setMenuItemImages({});
          return;
        }
        const data = snapshot.val();
        const map: Record<string, string> = {};
        Object.entries<any>(data).forEach(([id, value]) => {
          const imageUrl = value?.imageUrl || value?.photoUrl || value?.image;
          if (imageUrl) {
            map[id] = imageUrl;
          }
        });
        setMenuItemImages(map);
      },
      (err) => {
        console.error('Error loading menu items', err);
      }
    );

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
          const rawItems = Array.isArray(value.items) ? value.items : [];
          const items: OrderItem[] = rawItems.map((item: any) => ({
            itemId: item?.itemId || item?.id || '',
            name: item?.name || 'Item',
            quantity: Number(item?.quantity || 0),
            price: Number(item?.price || 0),
            variantName: item?.variantName,
            variantPriceAdjustment: Number(item?.variantPriceAdjustment || 0),
            addons: Array.isArray(item?.addons)
              ? item.addons.map((addon: any) => ({
                  name: addon?.name || addon?.label,
                  price: Number(addon?.price || 0),
                }))
              : undefined,
          }));
          list.push({
            orderId: id,
            status: value.status || 'pending',
            merchantName: value.merchantName || 'N/A',
            customerName: value.customerName || 'N/A',
            specialInstructions:
              value.specialInstructions ||
              value.special_instructions ||
              value.customerNotes ||
              value.notes ||
              '',
            driverId:
              value.driverId ||
              value.driver_id ||
              value.assignedDriverId ||
              value.assignedDriver ||
              value.driver?.id,
            driverName:
              value.driverName ||
              value.driver_name ||
              value.assignedDriverName ||
              value.driver?.name ||
              value.driver?.driverName ||
              '',
            items,
            subtotal: Number(value.subtotal || 0),
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

    const unsubscribeCommission = onValue(
      commissionRef,
      (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.val() || {};
        const driverRate = Number(data.driverCommissionRate);
        const merchantRate = Number(data.merchantCommissionRate);
        if (!Number.isNaN(driverRate)) setDriverCommissionRate(driverRate);
        if (!Number.isNaN(merchantRate)) setMerchantCommissionRate(merchantRate);
      },
      (err) => {
        console.error('Error loading commission settings', err);
      }
    );

    return () => {
      off(ordersRef);
      off(driversRef);
      off(menuItemsRef);
      unsubscribeDrivers();
      unsubscribeMenuItems();
      unsubscribeCommission();
    };
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
  const deliveryFeeTotal = delivered.reduce((s, o) => s + o.deliveryFee, 0);
  const platformTotal = delivered.reduce((s, o) => s + o.deliveryFee * driverCommissionRate, 0);
  const payoutTotal = delivered.reduce((s, o) => s + o.deliveryFee * (1 - driverCommissionRate), 0);

  const formatCurrency = (n: number) =>
    `PHP ${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (ts?: number) => {
    if (!ts) return '-';
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

  const fallbackImage =
    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect fill="%23f3f4f6" width="64" height="64"/><text fill="%239ca3af" font-family="Arial" font-size="10" x="50%" y="50%" text-anchor="middle" dy=".3em">No image</text></svg>';

  const itemTotal = (item: OrderItem) => {
    const base = (item.price + (item.variantPriceAdjustment || 0)) * item.quantity;
    const addonsTotal = (item.addons || []).reduce((sum, addon) => sum + addon.price * item.quantity, 0);
    return base + addonsTotal;
  };

  const deliveryCommission = (order: FoodOrder) => order.deliveryFee * driverCommissionRate;
  const driverPayout = (order: FoodOrder) => order.deliveryFee * (1 - driverCommissionRate);

  const merchantSummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        merchantName: string;
        deliveredOrders: number;
        itemCount: number;
        itemsSubtotal: number;
        items: Record<string, { itemId: string; name: string; quantity: number; total: number }>;
      }
    >();

    delivered.forEach((order) => {
      const key = order.merchantName || 'Unknown';
      const entry =
        map.get(key) ||
        {
          merchantName: key,
          deliveredOrders: 0,
          itemCount: 0,
          itemsSubtotal: 0,
          items: {},
        };
      entry.deliveredOrders += 1;

      let orderSubtotal = 0;
      order.items.forEach((item) => {
        const label = item.variantName ? `${item.name} (${item.variantName})` : item.name;
        const total = itemTotal(item);
        entry.itemCount += item.quantity;
        orderSubtotal += total;

        const key = `${item.itemId}|${label}`;
        if (!entry.items[key]) {
          entry.items[key] = { itemId: item.itemId, name: label, quantity: 0, total: 0 };
        }
        entry.items[key].quantity += item.quantity;
        entry.items[key].total += total;
      });
      entry.itemsSubtotal += orderSubtotal > 0 ? orderSubtotal : order.subtotal;
      map.set(key, entry);
    });

    return Array.from(map.values()).sort(
      (a, b) =>
        b.itemsSubtotal * merchantCommissionRate - a.itemsSubtotal * merchantCommissionRate
    );
  }, [delivered, merchantCommissionRate]);

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

        {/* Merchant item summary */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Merchant Item Sales (Delivered)</h2>
            <p className="text-sm text-gray-600">Item totals and commission per merchant</p>
          </div>
          {merchantSummaries.length === 0 ? (
            <p className="text-sm text-gray-500">No delivered orders yet.</p>
          ) : (
            <div className="grid gap-4">
              {merchantSummaries.map((summary) => {
                const topItems = Object.values(summary.items)
                  .sort((a, b) => b.total - a.total)
                  .slice(0, 5);
                return (
                  <div
                    key={summary.merchantName}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-gray-900">{summary.merchantName}</p>
                        <p className="text-xs text-gray-500">{summary.deliveredOrders} delivered orders</p>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm">
                        <span className="px-2 py-1 rounded bg-gray-50 text-gray-700">
                          Items: {summary.itemCount}
                        </span>
                        <span className="px-2 py-1 rounded bg-gray-50 text-gray-700">
                          Items Total: {formatCurrency(summary.itemsSubtotal)}
                        </span>
                        <span className="px-2 py-1 rounded bg-amber-50 text-amber-700">
                          Commission: {formatCurrency(summary.itemsSubtotal * merchantCommissionRate)}
                        </span>
                      </div>
                    </div>
                    {topItems.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-gray-600">Top Items</p>
                        <div className="mt-2 space-y-1 text-sm text-gray-700">
                          <div className="grid grid-cols-[minmax(0,1fr)_80px_110px_120px] items-center text-xs text-gray-500">
                            <span>Item</span>
                            <span className="text-right">Qty</span>
                            <span className="text-right">Total</span>
                            <span className="text-right">Commission</span>
                          </div>
                          {topItems.map((item) => (
                            <div
                              key={`${item.itemId}-${item.name}`}
                              className="grid grid-cols-[minmax(0,1fr)_80px_110px_120px] items-center"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <img
                                  src={menuItemImages[item.itemId] || fallbackImage}
                                  alt={item.name}
                                  className="w-8 h-8 rounded object-cover border border-gray-200"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = fallbackImage;
                                  }}
                                />
                                <span className="truncate">{item.name}</span>
                              </div>
                              <span className="text-right text-gray-500">{item.quantity}x</span>
                              <span className="text-right font-semibold">{formatCurrency(item.total)}</span>
                              <span className="text-right text-amber-700">
                                {formatCurrency(item.total * merchantCommissionRate)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
                  <Fragment key={order.orderId}>
                    <tr className="border-b hover:bg-gray-50 text-sm">
                      <td className="py-3 px-4 font-mono text-gray-800 break-all">{order.orderId}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusBadge(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-800">{order.merchantName}</td>
                      <td className="py-3 px-4 text-gray-600">{order.customerName}</td>
                      <td className="py-3 px-4 text-gray-600">
                        {(() => {
                          const name = (order.driverName || '').trim();
                          if (name) return name;
                          if (order.driverId) return driverNames[order.driverId] || order.driverId;
                          return '-';
                        })()}
                      </td>
                      <td className="py-3 px-4 text-gray-800">{formatCurrency(order.deliveryFee)}</td>
                      <td className="py-3 px-4 text-gray-800">{formatCurrency(deliveryCommission(order))}</td>
                      <td className="py-3 px-4 text-gray-800">{formatCurrency(driverPayout(order))}</td>
                      <td className="py-3 px-4 text-gray-800">{formatCurrency(order.totalAmount)}</td>
                      <td className="py-3 px-4 text-gray-600">{formatDate(order.createdAt)}</td>
                      <td className="py-3 px-4 text-gray-600">{formatDate(order.deliveredAt)}</td>
                    </tr>
                    <tr className="border-b bg-gray-50 text-xs text-gray-600">
                      <td colSpan={11} className="px-4 py-3">
                        <div className="space-y-2">
                          <div>
                            <span className="font-semibold text-gray-700">Items:</span>
                            <ul className="mt-1 space-y-1">
                              {order.items.map((item, index) => (
                                <li key={`${order.orderId}-${item.itemId}-${index}`}>
                                  <span className="font-semibold">{item.quantity}x</span> {item.name}
                                  {item.variantName ? ` (${item.variantName})` : ''}
                                  {item.addons && item.addons.length > 0 ? (
                                    <span className="text-gray-500">
                                      {' '}
                                      - addons:{' '}
                                      {item.addons
                                        .map((addon) =>
                                          addon.name
                                            ? `${addon.name} (+${formatCurrency(addon.price)})`
                                            : `+${formatCurrency(addon.price)}`
                                        )
                                        .join(', ')}
                                    </span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                          {order.specialInstructions ? (
                            <div>
                              <span className="font-semibold text-gray-700">Special instructions:</span>{' '}
                              {order.specialInstructions}
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  </Fragment>
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
