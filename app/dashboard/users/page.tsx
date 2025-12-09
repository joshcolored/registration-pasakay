'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ref, onValue, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import { User } from '@/types';
import { Search, UserX, UserCheck, Mail, Phone, Calendar } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    // Check if admin is logged in
    const adminUser = localStorage.getItem('adminUser');
    if (!adminUser) {
      router.push('/pasakay/login');
      return;
    }

    // Set up real-time listener for users
    const usersRef = ref(database, 'users');

    // Listen to users changes in real-time
    const unsubscribe = onValue(usersRef, (snapshot) => {
      try {
        if (snapshot.exists()) {
          const usersData = snapshot.val();
          const usersList: User[] = [];

          Object.entries(usersData).forEach(([id, user]: [string, any]) => {
            // Only show passengers (not drivers or admins)
            // Check both 'role' and 'userType' for compatibility
            const userRole = user.role || user.userType;
            if (userRole === 'passenger') {
              usersList.push({
                ...user,
                userId: id,
                // Map Flutter field names to web-admin field names
                name: user.name || 'N/A',
                email: user.email || 'N/A',
                phoneNumber: user.phone || user.phoneNumber || 'N/A',
                profileImageUrl: user.profileImage || user.profileImageUrl,
                rating: user.rating || 5.0,
                totalTrips: user.totalTrips || 0,
                createdAt: user.createdAt || Date.now(),
                isActive: user.active !== undefined ? user.active : (user.isActive !== undefined ? user.isActive : true),
              });
            }
          });

          // Sort by creation date (newest first)
          usersList.sort((a, b) => b.createdAt - a.createdAt);

          console.log('Users loaded:', usersList.length);
          console.log('Active users:', usersList.filter(u => u.isActive).length);

          setUsers(usersList);
          setFilteredUsers(usersList);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error loading users:', error);
        setLoading(false);
      }
    });

    // Cleanup listener on unmount
    return () => {
      unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    let filtered = users;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(user =>
        user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.phoneNumber?.includes(searchQuery)
      );
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(user =>
        filterStatus === 'active' ? user.isActive : !user.isActive
      );
    }

    setFilteredUsers(filtered);
  }, [searchQuery, filterStatus, users]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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
          <div>
            <h1 className="text-3xl font-bold text-black mb-2">Passenger Management</h1>
            <p className="text-black font-semibold">View and manage all passenger accounts</p>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-black text-sm font-bold mb-1">Total Passengers</p>
                <p className="text-3xl font-bold text-black">{users.length}</p>
              </div>
              <UserCheck className="w-12 h-12 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-black text-sm font-bold mb-1">Active Users</p>
                <p className="text-3xl font-bold text-green-600">
                  {users.filter(u => u.isActive).length}
                </p>
              </div>
              <UserCheck className="w-12 h-12 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-black text-sm font-bold mb-1">Inactive Users</p>
                <p className="text-3xl font-bold text-red-600">
                  {users.filter(u => !u.isActive).length}
                </p>
              </div>
              <UserX className="w-12 h-12 text-red-500" />
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
                placeholder="Search by name, email, or phone..."
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
                <option value="all">All Users</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-300">
                <tr>
                  <th className="text-left py-4 px-6 font-bold text-black">Name</th>
                  <th className="text-left py-4 px-6 font-bold text-black">Contact</th>
                  <th className="text-left py-4 px-6 font-bold text-black">Rating</th>
                  <th className="text-left py-4 px-6 font-bold text-black">Total Trips</th>
                  <th className="text-left py-4 px-6 font-bold text-black">Status</th>
                  <th className="text-left py-4 px-6 font-bold text-black">Joined</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-black font-semibold">
                      No passengers found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.userId} className="border-b hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-3">
                          {user.profileImageUrl ? (
                            <img
                              src={user.profileImageUrl}
                              alt={user.name || 'User'}
                              className="w-10 h-10 rounded-full object-cover border-2 border-blue-500"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                              <span className="text-white font-semibold">
                                {user.name?.charAt(0).toUpperCase() || 'U'}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-black">{user.name || 'N/A'}</p>
                            <p className="text-sm text-gray-700 font-medium">{user.userId.substring(0, 8)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 text-sm">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span className="text-black font-semibold">{user.email || 'N/A'}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-sm">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span className="text-black font-semibold">{user.phoneNumber || 'N/A'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-1">
                          <span className="text-yellow-500">★</span>
                          <span className="font-bold text-black">{user.rating?.toFixed(1) || '5.0'}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-bold text-black">{user.totalTrips || 0}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          user.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2 text-sm">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span className="text-black font-semibold">{formatDate(user.createdAt)}</span>
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
          Showing {filteredUsers.length} of {users.length} passengers
        </div>
      </div>
    </DashboardLayout>
  );
}

