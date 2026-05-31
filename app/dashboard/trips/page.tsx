'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ref, onValue, off } from 'firebase/database';
import { database } from '@/lib/firebase';
import { Trip } from '@/types';
import { Search, MapPin, Calendar, DollarSign, TrendingUp, Radio } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { getStoredAdminSession } from '@/lib/adminSession';

export default function TripsPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [filteredTrips, setFilteredTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'accepted' | 'ongoing' | 'completed' | 'cancelled'>('all');

  useEffect(() => {
    // Check if admin is logged in
    const adminUser = getStoredAdminSession();
    if (!adminUser) {
      router.push('/pasakay/login');
      return;
    }

    // Set up real-time listener for trips
    const tripsRef = ref(database, 'trips');
    
    const unsubscribe = onValue(tripsRef, (snapshot) => {
      if (snapshot.exists()) {
        const tripsData = snapshot.val();
        const tripsList: Trip[] = [];

        Object.entries(tripsData).forEach(([id, trip]: [string, any]) => {
          // Map Flutter field names to web-admin field names
          const pickupLocation = trip.pickupLocation || {};
          const dropoffLocation = trip.dropoffLocation || {};
          
          tripsList.push({
            ...trip,
            tripId: id,
            // Map location fields - handle both nested object and flat fields
            pickupAddress: trip.pickupAddress || pickupLocation.address || 'N/A',
            pickupLatitude: trip.pickupLatitude || pickupLocation.latitude,
            pickupLongitude: trip.pickupLongitude || pickupLocation.longitude,
            dropoffAddress: trip.dropoffAddress || dropoffLocation.address || 'N/A',
            dropoffLatitude: trip.dropoffLatitude || dropoffLocation.latitude,
            dropoffLongitude: trip.dropoffLongitude || dropoffLocation.longitude,
            // Map fare fields
            estimatedFare: trip.estimatedFare || trip.fare || 0,
            finalFare: trip.finalFare || trip.fare || 0,
            // Map date fields - handle ISO string or timestamp
            requestedAt: trip.requestedAt || (trip.createdAt ? new Date(trip.createdAt).getTime() : Date.now()),
            // Map passenger/driver info
            passengerName: trip.passengerName || 'N/A',
            passengerPhone: trip.passengerPhone || 'N/A',
            driverName: trip.driverName || 'Not assigned',
            driverVehicleNumber: trip.driverVehicleNumber || trip.vehicleNumber || 'N/A',
            // Distance and status
            distance: trip.distance || 0,
            actualDistance: trip.actualDistance || trip.distance || 0,
            status: trip.status || 'pending',
          });
        });

        // Sort by requested date (newest first)
        tripsList.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt as string).getTime() : (a.requestedAt || 0);
          const timeB = b.createdAt ? new Date(b.createdAt as string).getTime() : (b.requestedAt || 0);
          return timeB - timeA;
        });

        setTrips(tripsList);
      } else {
        setTrips([]);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error loading trips:', error);
      setLoading(false);
    });

    // Cleanup listener on unmount
    return () => {
      off(tripsRef);
    };
  }, [router]);

  useEffect(() => {
    let filtered = trips;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(trip =>
        trip.passengerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trip.driverName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trip.pickupAddress?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trip.dropoffAddress?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(trip => trip.status === filterStatus);
    }

    setFilteredTrips(filtered);
  }, [searchQuery, filterStatus, trips]);

  const formatDate = (timestamp: number | string | undefined) => {
    if (!timestamp) return 'N/A';
    const time = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
    return new Date(time).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const badges: any = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'accepted': 'bg-blue-100 text-blue-800',
      'ongoing': 'bg-purple-100 text-purple-800',
      'completed': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badges[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const calculateStats = () => {
    const totalRevenue = trips
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + (t.finalFare || 0), 0);

    const totalDistance = trips
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + (t.actualDistance || t.distance || 0), 0);

    return {
      totalRevenue,
      totalDistance,
      completedTrips: trips.filter(t => t.status === 'completed').length,
      cancelledTrips: trips.filter(t => t.status === 'cancelled').length,
      ongoingTrips: trips.filter(t => t.status === 'ongoing' || t.status === 'accepted').length,
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
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Trip Monitoring</h1>
              <p className="text-gray-600">View and monitor all trips in real-time</p>
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Total Trips</p>
                <p className="text-3xl font-bold text-gray-800">{trips.length}</p>
              </div>
              <MapPin className="w-12 h-12 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Completed</p>
                <p className="text-3xl font-bold text-green-600">{stats.completedTrips}</p>
              </div>
              <TrendingUp className="w-12 h-12 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Ongoing</p>
                <p className="text-3xl font-bold text-purple-600">{stats.ongoingTrips}</p>
              </div>
              <MapPin className="w-12 h-12 text-purple-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Total Revenue</p>
                <p className="text-2xl font-bold text-green-600">₱{stats.totalRevenue.toFixed(2)}</p>
              </div>
              <DollarSign className="w-12 h-12 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Total Distance</p>
                <p className="text-2xl font-bold text-blue-600">{stats.totalDistance.toFixed(1)} km</p>
              </div>
              <MapPin className="w-12 h-12 text-blue-500" />
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
                placeholder="Search by passenger, driver, or location..."
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
                <option value="all">All Trips</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Trips Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Trip ID</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Passenger</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Driver</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Route</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Distance</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Fare</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrips.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-500">
                      No trips found
                    </td>
                  </tr>
                ) : (
                  filteredTrips.map((trip) => (
                    <tr key={trip.tripId} className="border-b hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <span className="text-sm font-mono text-gray-600">
                          {trip.tripId.substring(0, 8)}...
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div>
                          <p className="font-semibold text-gray-800">{trip.passengerName || 'N/A'}</p>
                          <p className="text-sm text-gray-500">{trip.passengerPhone || 'N/A'}</p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div>
                          <p className="font-semibold text-gray-800">{trip.driverName || 'Not assigned'}</p>
                          <p className="text-sm text-gray-500">{trip.driverVehicleNumber || 'N/A'}</p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="max-w-xs">
                          <div className="flex items-start space-x-2 mb-1">
                            <MapPin className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-gray-700 truncate">{trip.pickupAddress || 'N/A'}</p>
                          </div>
                          <div className="flex items-start space-x-2">
                            <MapPin className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-gray-700 truncate">{trip.dropoffAddress || 'N/A'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-gray-700">
                          {(trip.actualDistance || trip.distance || 0).toFixed(1)} km
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-semibold text-green-600">
                          ₱{(trip.finalFare || trip.estimatedFare || 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {getStatusBadge(trip.status)}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(trip.createdAt || trip.requestedAt)}</span>
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
          Showing {filteredTrips.length} of {trips.length} trips
        </div>
      </div>
    </DashboardLayout>
  );
}
