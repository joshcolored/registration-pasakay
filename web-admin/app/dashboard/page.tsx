'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ref, onValue } from 'firebase/database';
import { database } from '@/lib/firebase';
import { DashboardStats, Trip, User, Driver, Payment } from '@/types';
import { Users, Car, MapPin, Clock, AlertCircle, UserCheck, CreditCard } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import StatsCard from '@/components/StatsCard';

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
    // Check if admin is logged in
    const adminUser = localStorage.getItem('adminUser');
    if (!adminUser) {
      router.push('/pasakay/login');
      return;
    }

    // Set up real-time listeners
    const driversRef = ref(database, 'drivers');
    const tripsRef = ref(database, 'trips');
    const usersRef = ref(database, 'users');

    // Listen to drivers changes in real-time
    const unsubscribeDrivers = onValue(driversRef, (driversSnapshot) => {
      let activeDrivers = 0;
      let totalDrivers = 0;
      let pendingDrivers = 0;

      if (driversSnapshot.exists()) {
        const drivers = driversSnapshot.val();
        totalDrivers = Object.keys(drivers).length;
        Object.values(drivers).forEach((driver: any) => {
          // Check both 'online' and 'isOnline' fields for compatibility
          if (driver.online || driver.isOnline) {
            activeDrivers++;
          }
          // Count pending drivers
          if (driver.verificationStatus === 'pending' || driver.status === 'pending') {
            pendingDrivers++;
          }
        });
        console.log('Dashboard - Total drivers:', totalDrivers);
        console.log('Dashboard - Online drivers:', activeDrivers);
      }

      setStats(prev => ({ ...prev, totalDrivers, activeDrivers, pendingDrivers }));
    });

    // Listen to trips changes in real-time
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

          // Add to recent trips with driver name
          recent.push({ 
            ...trip, 
            tripId: id,
            driverName: trip.driverName || (trip.driverId ? 'Assigned' : null)
          });
        });

        // Sort by createdAt/requestedAt and get last 5
        recent.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.requestedAt || 0);
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.requestedAt || 0);
          return timeB - timeA;
        });
        setRecentTrips(recent.slice(0, 5));

        console.log('Dashboard - Total trips:', totalTrips);
        console.log('Dashboard - Ongoing trips:', ongoingTrips);
      }

      setStats(prev => ({ ...prev, totalTrips, totalRevenue, ongoingTrips }));
    });

    // Listen to payments changes in real-time
    const paymentsRef = ref(database, 'subscription_payments');
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

      setStats(prev => ({ ...prev, pendingPayments }));
    });

    // Listen to users changes in real-time
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

      setStats(prev => ({ ...prev, totalUsers }));
    });

    setLoading(false);

    // Cleanup listeners on unmount
    return () => {
      unsubscribeDrivers();
      unsubscribeTrips();
      unsubscribePayments();
      unsubscribeUsers();
    };
  }, [router]);



  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null || isNaN(amount)) {
      return '₱0.00';
    }
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp || isNaN(timestamp)) return 'N/A';
    return new Date(timestamp).toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTimeAgo = (timestamp: number) => {
    if (!timestamp || isNaN(timestamp)) return 'N/A';
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
    // Handle createdAt as ISO string or timestamp
    if (trip.createdAt) {
      if (typeof trip.createdAt === 'string') {
        return new Date(trip.createdAt).getTime();
      }
      return trip.createdAt;
    }
    // Fallback to requestedAt
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
        return 'bg-green-100 text-green-800';
      case 'ongoing':
        return 'bg-blue-100 text-blue-800';
      case 'accepted':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-orange-100 text-orange-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-black">Dashboard Overview</h1>
          <div className="flex items-center space-x-2 bg-green-100 px-4 py-2 rounded-full">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-green-700 font-semibold text-sm">Live Updates</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Passengers"
            value={stats.totalUsers}
            icon={<Users className="w-6 h-6" />}
            color="blue"
          />
          <StatsCard
            title="Total Drivers"
            value={stats.totalDrivers}
            icon={<Car className="w-6 h-6" />}
            color="green"
            subtitle={`${stats.activeDrivers} online`}
          />
          <StatsCard
            title="Total Trips"
            value={stats.totalTrips}
            icon={<MapPin className="w-6 h-6" />}
            color="purple"
            subtitle={`${stats.ongoingTrips} ongoing`}
          />
          <StatsCard
            title="Total Revenue"
            value={formatCurrency(stats.totalRevenue)}
            icon={<span className="w-6 h-6 flex items-center justify-center font-bold text-lg">₱</span>}
            color="yellow"
          />
        </div>

        {/* Alert Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-black mb-1">Pending Driver Verifications</h3>
                <p className="text-3xl font-bold text-orange-600">{stats.pendingDrivers}</p>
              </div>
              <UserCheck className="w-12 h-12 text-orange-400" />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-black mb-1">Pending Payment Verifications</h3>
                <p className="text-3xl font-bold text-blue-600">{stats.pendingPayments}</p>
              </div>
              <CreditCard className="w-12 h-12 text-blue-400" />
            </div>
          </div>
        </div>

        {/* Recent Trips */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-black">Recent Trips</h2>
            <div className="flex items-center space-x-2 bg-green-100 px-3 py-1 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-green-700 font-semibold text-xs">Live</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left py-3 px-4 font-bold text-black">Passenger</th>
                  <th className="text-left py-3 px-4 font-bold text-black">Driver</th>
                  <th className="text-left py-3 px-4 font-bold text-black">Route</th>
                  <th className="text-left py-3 px-4 font-bold text-black">Fare</th>
                  <th className="text-left py-3 px-4 font-bold text-black">Status</th>
                  <th className="text-left py-3 px-4 font-bold text-black">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentTrips.map((trip) => (
                  <tr key={trip.tripId} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-black font-semibold">{trip.passengerName}</td>
                    <td className="py-3 px-4 text-black font-semibold">{trip.driverName || 'N/A'}</td>
                    <td className="py-3 px-4 text-sm text-black font-medium">
                      <div className="max-w-xs">
                        <div className="flex items-center space-x-1">
                          <span className="text-green-600">●</span>
                          <span className="truncate">{trip.pickupLocation?.address || trip.pickupAddress || 'N/A'}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="text-red-600">●</span>
                          <span className="truncate">{trip.dropoffLocation?.address || trip.dropoffAddress || 'N/A'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-black font-semibold">{formatCurrency(trip.fare || trip.finalFare || trip.estimatedFare || 0)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(trip.status)}`}>
                        {trip.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-black font-medium">
                      <div>{formatTimeAgo(getTimestamp(trip))}</div>
                      <div className="text-xs text-gray-500">{formatDate(getTimestamp(trip))}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
