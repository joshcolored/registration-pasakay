'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ref, get, onValue, update, remove } from 'firebase/database';
import { database } from '@/lib/firebase';
import { User, Driver } from '@/types';
import { Search, Car, UserCheck, UserX, Mail, Phone, Calendar, MapPin, XCircle, RotateCcw, Trash2 } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';

interface DriverWithUser extends Driver {
  user?: User;
}

export default function DriversPage() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<DriverWithUser[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<DriverWithUser[]>([]);
  const [deliveryTotals, setDeliveryTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline'>('all');
  const [expiringDriverId, setExpiringDriverId] = useState<string | null>(null);
  const [restoringDriverId, setRestoringDriverId] = useState<string | null>(null);
  const [deletingDriverId, setDeletingDriverId] = useState<string | null>(null);
  const [driverCommissionRate, setDriverCommissionRate] = useState(0.1);

  const expireDriverSubscription = async (driverId: string, driverName: string, driver: DriverWithUser) => {
    const confirmed = window.confirm(
      `Are you sure you want to expire ${driverName}'s subscription immediately?\n\nYou can restore it later if needed.`
    );
    
    if (!confirmed) return;
    
    setExpiringDriverId(driverId);
    
    try {
      const driverRef = ref(database, `drivers/${driverId}`);
      const now = Date.now();
      
      // Save original subscription data before expiring
      await update(driverRef, {
        subscriptionStatus: 'expired',
        hasActiveSubscription: false,
        subscriptionEndDate: now - 1000,
        subscriptionExpiry: new Date(now - 1000).toISOString(),
        expiredManually: true,
        expiredAt: now,
        expiredBy: 'admin',
        // Save original data for restoration
        originalSubscriptionEndDate: driver.subscriptionEndDate,
        originalSubscriptionExpiry: driver.subscriptionExpiry,
        originalSubscriptionStatus: driver.subscriptionStatus,
        originalSubscriptionType: driver.subscriptionType || driver.subscriptionPlan,
      });
      
      alert(`${driverName}'s subscription has been expired successfully.\n\nYou can restore it using the "Restore" button.`);
    } catch (error) {
      console.error('Error expiring subscription:', error);
      alert('Failed to expire subscription. Please try again.');
    } finally {
      setExpiringDriverId(null);
    }
  };

  const restoreDriverSubscription = async (driverId: string, driverName: string, driver: DriverWithUser) => {
    const originalEndDate = (driver as any).originalSubscriptionEndDate;
    const originalExpiry = (driver as any).originalSubscriptionExpiry;
    const originalStatus = (driver as any).originalSubscriptionStatus;
    const originalType = (driver as any).originalSubscriptionType;
    
    if (!originalEndDate) {
      alert('Cannot restore: Original subscription data not found.');
      return;
    }
    
    const formattedDate = new Date(originalEndDate).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    
    const confirmed = window.confirm(
      `Restore ${driverName}'s subscription?\n\nOriginal expiry date: ${formattedDate}\nPlan: ${originalType || 'N/A'}`
    );
    
    if (!confirmed) return;
    
    setRestoringDriverId(driverId);
    
    try {
      const driverRef = ref(database, `drivers/${driverId}`);
      
      await update(driverRef, {
        subscriptionStatus: originalStatus || 'active',
        hasActiveSubscription: true,
        subscriptionEndDate: originalEndDate,
        subscriptionExpiry: originalExpiry,
        subscriptionType: originalType,
        subscriptionPlan: originalType,
        expiredManually: false,
        expiredAt: null,
        expiredBy: null,
        restoredAt: Date.now(),
        restoredBy: 'admin',
      });
      
      alert(`${driverName}'s subscription has been restored successfully!`);
    } catch (error) {
      console.error('Error restoring subscription:', error);
      alert('Failed to restore subscription. Please try again.');
    } finally {
      setRestoringDriverId(null);
    }
  };

  const deleteDriverAccount = async (driver: DriverWithUser) => {
    const driverName = driver.user?.name || 'this driver';
    const confirmed = window.confirm(
      `Delete ${driverName}?\n\nThis will remove the driver and user records. This cannot be undone.`
    );

    if (!confirmed) return;

    const driverId = driver.driverId;
    const userId = driver.userId || driver.driverId;

    setDeletingDriverId(driverId);

    try {
      await Promise.all([
        remove(ref(database, `drivers/${driverId}`)),
        remove(ref(database, `users/${userId}`)),
      ]);

      alert(`${driverName} has been deleted.`);
    } catch (error) {
      console.error('Error deleting driver:', error);
      alert('Failed to delete driver. Please try again.');
    } finally {
      setDeletingDriverId(null);
    }
  };

  useEffect(() => {
    // Check if admin is logged in
    const adminUser = localStorage.getItem('adminUser');
    if (!adminUser) {
      router.push('/pasakay/login');
      return;
    }

    // Set up real-time listeners for drivers
    const driversRef = ref(database, 'drivers');
    const usersRef = ref(database, 'users');
    const foodOrdersRef = ref(database, 'food_orders');
    const commissionRef = ref(database, 'settings/commission');

    // Listen to drivers changes in real-time
    const unsubscribeDrivers = onValue(driversRef, async (driversSnapshot) => {
      try {
        if (driversSnapshot.exists()) {
          // Get users data
          const usersSnapshot = await get(usersRef);
          const driversData = driversSnapshot.val();
          const usersData = usersSnapshot.exists() ? usersSnapshot.val() : {};
          const driversList: DriverWithUser[] = [];

          Object.entries(driversData).forEach(([id, driver]: [string, any]) => {
            // Get user data for this driver - try both driver.userId and driver.uid
            const driverUserId = driver.userId || driver.uid || id;
            const userData = usersData[driverUserId];

            // Map field names between Flutter and web-admin for consistency
            const driverWithUser = {
              ...driver,
              driverId: id,
              userId: driverUserId,
              user: userData ? {
                ...userData,
                name: userData.name || userData.fullName || userData.displayName || 'N/A',
                phoneNumber: userData.phone || userData.phoneNumber || 'N/A',
                email: userData.email || 'N/A',
                profileImageUrl: userData.profileImage || userData.profileImageUrl,
              } : null,
              // Map Flutter field names to web-admin field names
              vehicleNumber: driver.vehicleNumber || 'N/A',
              vehicleModel: driver.vehicleModel || 'N/A',
              licenseNumber: driver.vehicleLicense || driver.licenseNumber || 'N/A',
              profileImageUrl: driver.profileImage || driver.profileImageUrl,
              isOnline: driver.online || driver.isOnline || false,
              totalEarnings: driver.totalEarnings || 0,
              completedTrips: driver.completedTrips || 0,
              // Subscription fields - handle both naming conventions
              subscriptionStatus: driver.subscriptionStatus || 
                (driver.hasActiveSubscription ? 'active' : 'expired') ||
                (driver.subscriptionPlan === 'freeTrial' ? 'free_trial' : 'expired'),
              subscriptionType: driver.subscriptionType || driver.subscriptionPlan || '',
              subscriptionEndDate: driver.subscriptionEndDate || 
                (driver.subscriptionExpiry ? new Date(driver.subscriptionExpiry).getTime() : null),
              subscriptionStartDate: driver.subscriptionStartDate || null,
              verificationStatus: driver.verificationStatus || driver.status || 'pending',
            };

            driversList.push(driverWithUser);
          });

          // Sort by online status and then by name
          driversList.sort((a, b) => {
            if (a.isOnline !== b.isOnline) {
              return a.isOnline ? -1 : 1;
            }
            return (a.user?.name || '').localeCompare(b.user?.name || '');
          });

          console.log('Drivers loaded:', driversList.length);
          console.log('Online drivers:', driversList.filter(d => d.isOnline).length);
          console.log('Sample driver data:', driversList[0]); // Log first driver to see structure

          setDrivers(driversList);
          setFilteredDrivers(driversList);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error loading drivers:', error);
        setLoading(false);
      }
    });

    const unsubscribeFoodOrders = onValue(foodOrdersRef, (foodOrdersSnapshot) => {
      if (!foodOrdersSnapshot.exists()) {
        setDeliveryTotals({});
        return;
      }

      const data = foodOrdersSnapshot.val();
      const totals: Record<string, number> = {};

      Object.values<any>(data).forEach((order: any) => {
        if ((order?.status || '').toLowerCase() !== 'delivered') return;
        const driverId =
          order?.driverId ||
          order?.driver_id ||
          order?.assignedDriverId ||
          order?.assignedDriver ||
          '';
        if (!driverId) return;

        let fee = Number(order?.deliveryFee || 0);
        if (fee <= 0) {
          const payout = Number(order?.driverPayout || 0);
          if (payout > 0) {
            fee = payout / (1 - driverCommissionRate);
          }
        }

        if (fee <= 0) return;
        totals[driverId] = (totals[driverId] || 0) + fee;
      });

      setDeliveryTotals(totals);
    });

    const unsubscribeCommission = onValue(commissionRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.val() || {};
      const rate = Number(data.driverCommissionRate);
      if (!Number.isNaN(rate)) {
        setDriverCommissionRate(rate);
      }
    });

    // Cleanup listener on unmount
    return () => {
      unsubscribeDrivers();
      unsubscribeFoodOrders();
      unsubscribeCommission();
    };
  }, [router, driverCommissionRate]);

  useEffect(() => {
    let filtered = drivers;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(driver =>
        driver.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        driver.user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        driver.vehicleNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        driver.licenseNumber?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(driver =>
        filterStatus === 'online' ? driver.isOnline : !driver.isOnline
      );
    }

    setFilteredDrivers(filtered);
  }, [searchQuery, filterStatus, drivers]);

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (driver: DriverWithUser) => {
    if (driver.isOnline) {
      return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">Online</span>;
    }
    return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">Offline</span>;
  };

  const getTimeRemaining = (endDate: number) => {
    const now = Date.now();
    const diff = endDate - now;

    if (diff <= 0) {
      return 'Expired';
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return `${days}d ${hours}h`;
    } else {
      return `${hours}h`;
    }
  };

  const getSubscriptionBadge = (status: string) => {
    const badges: any = {
      'active': 'bg-green-100 text-green-800',
      'expired': 'bg-red-100 text-red-800',
      'free_trial': 'bg-blue-100 text-blue-800',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badges[status] || 'bg-gray-100 text-gray-800'}`}>
        {status === 'free_trial' ? 'Free Trial' : status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getPlanDisplay = (subscriptionType?: string) => {
    if (!subscriptionType) return '';
    const planLower = subscriptionType.toLowerCase();
    
    if (planLower === 'free_trial' || planLower === 'freetrial') {
      return '🎁 Free Trial (15 Days)';
    } else if (planLower === '1_month' || planLower === 'onemonth' || planLower === 'one_month') {
      return '📦 1 Month Plan';
    } else if (planLower === '3_months' || planLower === 'threemonths' || planLower === 'three_months') {
      return '📦 3 Months Plan';
    }
    return '';
  };

  const getSubscriptionInfo = (driver: DriverWithUser) => {
    // Determine subscription status - handle multiple field names
    let status = driver.subscriptionStatus || 'none';
    const endDate = driver.subscriptionEndDate;
    const planType = driver.subscriptionType || driver.subscriptionPlan;
    const hasActive = driver.hasActiveSubscription;
    
    // Normalize status
    if (status === 'none' || !status) {
      if (hasActive) {
        status = 'active';
      } else if (planType) {
        const planLower = (planType || '').toLowerCase();
        if (planLower.includes('trial') || planLower === 'freetrial') {
          status = 'free_trial';
        } else {
          status = 'expired';
        }
      } else {
        status = 'none';
      }
    }

    // Check if subscription is actually expired
    if (endDate && new Date(endDate).getTime() < Date.now()) {
      status = 'expired';
    }

    // If no subscription info at all
    if (status === 'none' && !planType && !endDate) {
      return (
        <div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
            No Subscription
          </span>
        </div>
      );
    }

    const planDisplay = getPlanDisplay(planType);
    
    // Format expiry date if available
    let expiryDate = '';
    let timeRemaining = '';
    if (endDate) {
      const endDateTime = typeof endDate === 'string' ? new Date(endDate).getTime() : endDate;
      expiryDate = new Date(endDateTime).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      timeRemaining = getTimeRemaining(endDateTime);
    }

    return (
      <div className="space-y-1">
        {getSubscriptionBadge(status)}
        {planDisplay && (
          <div className="text-xs font-semibold text-purple-600">
            {planDisplay}
          </div>
        )}
        {endDate && (status === 'active' || status === 'free_trial') && (
          <div className="text-xs text-gray-600">
            <div className="flex items-center space-x-1">
              <Calendar className="w-3 h-3" />
              <span>Expires: {expiryDate}</span>
            </div>
            <div className="text-blue-600 font-semibold mt-0.5">
              ({timeRemaining})
            </div>
          </div>
        )}
        {endDate && status === 'expired' && (
          <div className="text-xs text-red-600">
            Expired: {expiryDate}
          </div>
        )}
      </div>
    );
  };

  const getDriverGrossEarnings = (driver: DriverWithUser) => {
    const tripEarnings = driver.totalEarnings || 0;
    const deliveryEarnings = deliveryTotals[driver.driverId] || 0;
    return tripEarnings + deliveryEarnings;
  };

  const getDriverCommission = (driver: DriverWithUser) => getDriverGrossEarnings(driver) * driverCommissionRate;

  const getDriverNetEarnings = (driver: DriverWithUser) =>
    getDriverGrossEarnings(driver) - getDriverCommission(driver);

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
          <div>
            <h1 className="text-3xl font-bold text-black mb-2">Driver Management</h1>
            <p className="text-black font-semibold">View and manage all driver accounts</p>
          </div>
          <div className="flex items-center space-x-2 bg-green-100 px-4 py-2 rounded-full">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-green-700 font-semibold text-sm">Live Updates</span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-black text-sm font-bold mb-1">Total Drivers</p>
                <p className="text-3xl font-bold text-black">{drivers.length}</p>
              </div>
              <Car className="w-12 h-12 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-black text-sm font-bold mb-1">Online Now</p>
                <p className="text-3xl font-bold text-green-600">
                  {drivers.filter(d => d.isOnline).length}
                </p>
              </div>
              <UserCheck className="w-12 h-12 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-black text-sm font-bold mb-1">Offline</p>
                <p className="text-3xl font-bold text-gray-600">
                  {drivers.filter(d => !d.isOnline).length}
                </p>
              </div>
              <UserX className="w-12 h-12 text-gray-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-black text-sm font-bold mb-1">Total Earnings</p>
                <p className="text-3xl font-bold text-purple-600">
                  ₱{drivers.reduce((sum, d) => sum + getDriverNetEarnings(d), 0).toFixed(2)}
                </p>
              </div>
              <Car className="w-12 h-12 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name, vehicle, or license..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-black font-semibold placeholder-gray-400"
              />
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-black font-semibold"
              >
                <option value="all">All Drivers</option>
                <option value="online">Online Only</option>
                <option value="offline">Offline Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Drivers Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Driver</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">UID</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Vehicle</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Contact</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Trips</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Earnings</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Subscription</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-500">
                      No drivers found
                    </td>
                  </tr>
                ) : (
                  filteredDrivers.map((driver) => (
                    <tr key={driver.driverId} className="border-b hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-3">
                          {driver.user?.profileImageUrl || driver.profileImageUrl ? (
                            <img
                              src={driver.user?.profileImageUrl || driver.profileImageUrl}
                              alt={driver.user?.name || 'Driver'}
                              className="w-10 h-10 rounded-full object-cover border-2 border-green-500"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center">
                              <span className="text-white font-semibold">
                                {driver.user?.name?.charAt(0).toUpperCase() || 'D'}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-gray-800">{driver.user?.name || 'N/A'}</p>
                            <p className="text-sm text-gray-500">License: {driver.licenseNumber || 'N/A'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-sm font-mono text-gray-800 break-all">
                          {driver.driverId}
                        </p>
                      </td>
                      <td className="py-4 px-6">
                        <div>
                          <p className="font-semibold text-gray-800">{driver.vehicleNumber || 'N/A'}</p>
                          <p className="text-sm text-gray-500">{driver.vehicleModel || 'N/A'}</p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 text-sm">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-700">{driver.user?.phoneNumber || 'N/A'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-semibold text-gray-800">{driver.completedTrips || 0}</span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-0.5">
                          <div className="text-xs text-gray-500">
                            Commission: ₱{getDriverCommission(driver).toFixed(2)}
                          </div>
                          <span className="font-semibold text-green-600">
                            ₱{getDriverNetEarnings(driver).toFixed(2)}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {getSubscriptionInfo(driver)}
                      </td>
                      <td className="py-4 px-6">
                        {getStatusBadge(driver)}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col space-y-2">
                          {/* Show Expire button for active subscriptions */}
                          {(driver.subscriptionStatus === 'active' || 
                            driver.subscriptionStatus === 'free_trial' ||
                            driver.hasActiveSubscription) && (
                            <button
                              onClick={() => expireDriverSubscription(
                                driver.driverId,
                                driver.user?.name || 'Unknown Driver',
                                driver
                              )}
                              disabled={expiringDriverId === driver.driverId}
                              className="flex items-center space-x-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-xs font-semibold rounded-lg transition-colors"
                            >
                              {expiringDriverId === driver.driverId ? (
                                <>
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                  <span>Expiring...</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Expire Now</span>
                                </>
                              )}
                            </button>
                          )}
                          
                          {/* Show Restore button for manually expired subscriptions */}
                          {(driver as any).expiredManually && (driver as any).originalSubscriptionEndDate && (
                            <button
                              onClick={() => restoreDriverSubscription(
                                driver.driverId,
                                driver.user?.name || 'Unknown Driver',
                                driver
                              )}
                              disabled={restoringDriverId === driver.driverId}
                              className="flex items-center space-x-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white text-xs font-semibold rounded-lg transition-colors"
                            >
                              {restoringDriverId === driver.driverId ? (
                                <>
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                  <span>Restoring...</span>
                                </>
                              ) : (
                                <>
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Restore</span>
                                </>
                              )}
                            </button>
                          )}

                          <button
                            onClick={() => deleteDriverAccount(driver)}
                            disabled={deletingDriverId === driver.driverId}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-gray-800 hover:bg-black disabled:bg-gray-500 text-white text-xs font-semibold rounded-lg transition-colors"
                          >
                            {deletingDriverId === driver.driverId ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                <span>Deleting...</span>
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </>
                            )}
                          </button>
                        </div>
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
          Showing {filteredDrivers.length} of {drivers.length} drivers
        </div>
      </div>
    </DashboardLayout>
  );
}
