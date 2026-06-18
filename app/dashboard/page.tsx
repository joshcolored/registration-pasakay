'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ref, onValue } from 'firebase/database';
import { database } from '@/lib/firebase';
import { DashboardStats, Trip } from '@/types';
import {
  Activity,
  ArrowRight,
  Car,
  CircleDollarSign,
  CreditCard,
  MapPin,
  Radio,
  Route,
  UserCheck,
  Users,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import StatsCard from '@/components/StatsCard';
import PasakayLoader from '@/components/PasakayLoader';
import { getStoredAdminSession } from '@/lib/adminSession';

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalDrivers: 0,
    activeDrivers: 0,
    totalTrips: 0,
    totalRevenue: 0,
    ongoingTrips: 0,
    pendingPayments: 0,
    pendingDrivers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentTrips, setRecentTrips] = useState<Trip[]>([]);

  useEffect(() => {
    const adminUser = getStoredAdminSession();
    if (!adminUser) {
      router.push('/pasakay/login');
      return;
    }

    const driversRef = ref(database, 'drivers');
    const tripsRef = ref(database, 'trips');
    const usersRef = ref(database, 'users');
    const paymentsRef = ref(database, 'subscription_payments');

    const unsubscribeDrivers = onValue(driversRef, (driversSnapshot) => {
      let activeDrivers = 0;
      let totalDrivers = 0;
      let pendingDrivers = 0;

      if (driversSnapshot.exists()) {
        const drivers = driversSnapshot.val();
        totalDrivers = Object.keys(drivers).length;
        Object.values(drivers).forEach((driver: any) => {
          if (driver.online || driver.isOnline) activeDrivers++;
          if (driver.verificationStatus === 'pending' || driver.status === 'pending') {
            pendingDrivers++;
          }
        });
      }

      setStats((prev) => ({ ...prev, totalDrivers, activeDrivers, pendingDrivers }));
    });

    const unsubscribeTrips = onValue(tripsRef, (tripsSnapshot) => {
      let totalTrips = 0;
      let totalRevenue = 0;
      let ongoingTrips = 0;
      const recent: Trip[] = [];

      if (tripsSnapshot.exists()) {
        const trips = tripsSnapshot.val();

        Object.entries(trips).forEach(([id, trip]: [string, any]) => {
          totalTrips++;

          if (trip.status === 'completed') {
            totalRevenue += trip.fare || trip.finalFare || 0;
          }

          if (trip.status === 'ongoing' || trip.status === 'accepted') {
            ongoingTrips++;
          }

          recent.push({
            ...trip,
            tripId: id,
            driverName: trip.driverName || (trip.driverId ? 'Assigned' : null),
          });
        });

        recent.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : a.requestedAt || 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : b.requestedAt || 0;
          return timeB - timeA;
        });
        setRecentTrips(recent.slice(0, 5));
      } else {
        setRecentTrips([]);
      }

      setStats((prev) => ({ ...prev, totalTrips, totalRevenue, ongoingTrips }));
    });

    const unsubscribePayments = onValue(paymentsRef, (paymentsSnapshot) => {
      let pendingPayments = 0;

      if (paymentsSnapshot.exists()) {
        const payments = paymentsSnapshot.val();
        Object.values(payments).forEach((payment: any) => {
          if (payment.status === 'pending' || payment.status === 'pending_verification' || !payment.status) {
            pendingPayments++;
          }
        });
      }

      setStats((prev) => ({ ...prev, pendingPayments }));
    });

    const unsubscribeUsers = onValue(usersRef, (usersSnapshot) => {
      let totalUsers = 0;

      if (usersSnapshot.exists()) {
        const users = usersSnapshot.val();
        Object.values(users).forEach((user: any) => {
          if (user.userType === 'passenger' || user.role === 'passenger') {
            totalUsers++;
          }
        });
      }

      setStats((prev) => ({ ...prev, totalUsers }));
    });

    setLoading(false);

    return () => {
      unsubscribeDrivers();
      unsubscribeTrips();
      unsubscribePayments();
      unsubscribeUsers();
    };
  }, [router]);

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null || Number.isNaN(amount)) {
      return 'PHP 0.00';
    }

    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp || Number.isNaN(timestamp)) return 'N/A';
    return new Date(timestamp).toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTimeAgo = (timestamp: number) => {
    if (!timestamp || Number.isNaN(timestamp)) return 'N/A';
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return formatDate(timestamp);
  };

  const getTimestamp = (trip: any): number => {
    if (trip.createdAt) {
      if (typeof trip.createdAt === 'string') {
        return new Date(trip.createdAt).getTime();
      }
      return trip.createdAt;
    }
    if (trip.requestedAt) {
      if (typeof trip.requestedAt === 'string') {
        return new Date(trip.requestedAt).getTime();
      }
      return trip.requestedAt;
    }
    return Date.now();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100';
      case 'ongoing':
        return 'bg-sky-50 text-sky-700 ring-1 ring-sky-100';
      case 'accepted':
        return 'bg-amber-50 text-amber-700 ring-1 ring-amber-100';
      case 'pending':
        return 'bg-orange-50 text-orange-700 ring-1 ring-orange-100';
      case 'cancelled':
        return 'bg-rose-50 text-rose-700 ring-1 ring-rose-100';
      default:
        return 'bg-stone-100 text-stone-700 ring-1 ring-stone-200';
    }
  };

  const onlineDriverRatio = useMemo(() => {
    if (!stats.totalDrivers) return 0;
    return Math.round((stats.activeDrivers / stats.totalDrivers) * 100);
  }, [stats.activeDrivers, stats.totalDrivers]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-screen items-center justify-center">
          <PasakayLoader size="page" label="Loading dashboard" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="admin-page">
        <section className="mb-6 overflow-hidden rounded-lg border border-[#163633] bg-[#10201e] text-white shadow-xl shadow-[#10201e]/10">
          <div className="grid gap-6 p-6 lg:grid-cols-[1fr_22rem] lg:p-7">
            <div>
              <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#78d1c8]">
                <Radio className="h-4 w-4" />
                Realtime operations
              </div>
              <h1 className="mt-5 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                Dashboard Overview
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/64">
                Live counts for passengers, drivers, trips, revenue, and review queues from the Pasakay admin feed.
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">
                  Driver availability
                </p>
                <span className="rounded-md bg-emerald-300/15 px-2 py-1 text-xs font-bold text-emerald-100">
                  {onlineDriverRatio}%
                </span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#78d1c8] transition-all duration-500"
                  style={{ width: `${onlineDriverRatio}%` }}
                />
              </div>
              <div className="mt-4 grid grid-cols-2 divide-x divide-white/10">
                <div className="pr-4">
                  <p className="text-2xl font-bold">{stats.activeDrivers}</p>
                  <p className="mt-1 text-xs text-white/50">Online drivers</p>
                </div>
                <div className="pl-4">
                  <p className="text-2xl font-bold">{stats.ongoingTrips}</p>
                  <p className="mt-1 text-xs text-white/50">Active trips</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            title="Total Passengers"
            value={stats.totalUsers}
            icon={<Users className="h-6 w-6" />}
            color="blue"
            subtitle="Registered passenger accounts"
          />
          <StatsCard
            title="Total Drivers"
            value={stats.totalDrivers}
            icon={<Car className="h-6 w-6" />}
            color="green"
            subtitle={`${stats.activeDrivers} online now`}
            trend={`${onlineDriverRatio}% active`}
          />
          <StatsCard
            title="Total Trips"
            value={stats.totalTrips}
            icon={<MapPin className="h-6 w-6" />}
            color="purple"
            subtitle={`${stats.ongoingTrips} ongoing or accepted`}
          />
          <StatsCard
            title="Total Revenue"
            value={formatCurrency(stats.totalRevenue)}
            icon={<CircleDollarSign className="h-6 w-6" />}
            color="yellow"
            subtitle="Completed trip fares"
          />
        </section>

        <section className="mb-6 overflow-hidden rounded-lg border border-[#dfe5e1] bg-white shadow-sm">
          <div className="border-b border-[#e5e2d8] bg-[#fbfcf9] px-5 py-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-[#18211f]">Action Queues</h2>
                <p className="text-sm text-[#66736f]">
                  Items that need an admin decision.
                </p>
              </div>
              <span className="w-fit rounded-md border border-[#dfe5e1] bg-white px-2.5 py-1 text-xs font-semibold text-[#66736f]">
                {stats.pendingDrivers + stats.pendingPayments} open
              </span>
            </div>
          </div>

          <div className="divide-y divide-[#edf0eb]">
            <Link
              href="/dashboard/driver-verification"
              className="group grid gap-4 px-5 py-4 transition hover:bg-[#fbfcf9] sm:grid-cols-[auto_1fr_auto_auto] sm:items-center"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[#eadcc8] bg-[#f7f1e8] text-[#a46312]">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-[#18211f]">Pending Driver Verifications</h3>
                  <span className="rounded-md bg-[#f7f1e8] px-2 py-0.5 text-xs font-semibold text-[#8a5a12]">
                    Review
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#66736f]">
                  License and vehicle submissions waiting for approval.
                </p>
              </div>
              <p className="text-2xl font-semibold text-[#18211f] sm:text-right">
                {stats.pendingDrivers}
              </p>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#49534f]">
                Open
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>

            <Link
              href="/dashboard/payments"
              className="group grid gap-4 px-5 py-4 transition hover:bg-[#fbfcf9] sm:grid-cols-[auto_1fr_auto_auto] sm:items-center"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[#dfe5e1] bg-[#f3f7f6] text-[#1f6f68]">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-[#18211f]">Pending Payment Verifications</h3>
                  <span className="rounded-md bg-[#e8f4f2] px-2 py-0.5 text-xs font-semibold text-[#1f6f68]">
                    Finance
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#66736f]">
                  Subscription receipts and payment status changes to confirm.
                </p>
              </div>
              <p className="text-2xl font-semibold text-[#18211f] sm:text-right">
                {stats.pendingPayments}
              </p>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#49534f]">
                Review
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-[#dfe5e1] bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[#e5e2d8] bg-[#fbfcf9] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#18211f]">Recent Trips</h2>
              <p className="mt-1 text-sm text-[#66736f]">
                Latest trip activity from the realtime feed.
              </p>
            </div>
            <Link
              href="/dashboard/trips"
              className="inline-flex w-fit items-center gap-2 rounded-md border border-[#dfe5e1] bg-white px-3 py-2 text-sm font-bold text-[#49534f] transition hover:bg-[#edf0eb] hover:text-[#18211f]"
            >
              View all trips
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#ebe7dc] bg-white">
                  {['Passenger', 'Driver', 'Route', 'Fare', 'Status', 'Time'].map((heading) => (
                    <th
                      key={heading}
                      className="px-5 py-3 text-left text-xs font-bold uppercase tracking-[0.12em] text-[#66736f]"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentTrips.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-[#f3f6f2] text-[#66736f]">
                          <Activity className="h-5 w-5" />
                        </div>
                        <p className="font-bold text-[#18211f]">No recent trips yet</p>
                        <p className="mt-1 text-sm text-[#66736f]">
                          Trip requests will show here as they arrive.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  recentTrips.map((trip) => {
                    const timestamp = getTimestamp(trip);
                    return (
                      <tr
                        key={trip.tripId}
                        className="border-b border-[#f0ede5] transition hover:bg-[#fbfcf9]"
                      >
                        <td className="px-5 py-4">
                          <p className="font-bold text-[#18211f]">{trip.passengerName || 'N/A'}</p>
                          <p className="mt-1 text-xs text-[#89918d]">
                            {trip.tripId ? trip.tripId.slice(0, 8) : 'No ID'}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-sm font-medium text-[#49534f]">
                          {trip.driverName || 'N/A'}
                        </td>
                        <td className="px-5 py-4 text-sm text-[#49534f]">
                          <div className="max-w-xs space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                              <span className="truncate">
                                {trip.pickupLocation?.address || trip.pickupAddress || 'N/A'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Route className="h-3.5 w-3.5 shrink-0 text-[#89918d]" />
                              <span className="truncate">
                                {trip.dropoffLocation?.address || trip.dropoffAddress || 'N/A'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-bold text-[#18211f]">
                          {formatCurrency(trip.fare || trip.finalFare || trip.estimatedFare || 0)}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`rounded-md px-2.5 py-1 text-xs font-bold capitalize ${getStatusColor(
                              trip.status
                            )}`}
                          >
                            {trip.status || 'unknown'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-[#49534f]">
                          <div className="font-bold">{formatTimeAgo(timestamp)}</div>
                          <div className="text-xs text-[#89918d]">{formatDate(timestamp)}</div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
