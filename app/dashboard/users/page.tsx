'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ref, onValue, remove } from 'firebase/database';
import { database } from '@/lib/firebase';
import { User } from '@/types';
import { Search, UserX, UserCheck, Mail, Phone, Calendar, Trash2, ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import PasakayLoader from '@/components/PasakayLoader';
import { getStoredAdminSession } from '@/lib/adminSession';

type SortKey = 'name' | 'uid' | 'contact' | 'rating' | 'totalTrips' | 'status' | 'joined';
type SortDirection = 'asc' | 'desc';

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('joined');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    // Check if admin is logged in
    const adminUser = getStoredAdminSession();
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

    const getSortValue = (user: User) => {
      switch (sortKey) {
        case 'name':
          return user.name || '';
        case 'uid':
          return user.userId || '';
        case 'contact':
          return `${user.email || ''} ${user.phoneNumber || ''}`;
        case 'rating':
          return Number(user.rating || 0);
        case 'totalTrips':
          return Number(user.totalTrips || 0);
        case 'status':
          return user.isActive ? 1 : 0;
        case 'joined': {
          const joined = typeof user.createdAt === 'number' ? user.createdAt : Date.parse(String(user.createdAt || ''));
          return Number.isNaN(joined) ? 0 : joined;
        }
      }
    };

    filtered = [...filtered].sort((a, b) => {
      const aValue = getSortValue(a);
      const bValue = getSortValue(b);
      const comparison =
        typeof aValue === 'number' && typeof bValue === 'number'
          ? aValue - bValue
          : String(aValue).localeCompare(String(bValue), undefined, {
              numeric: true,
              sensitivity: 'base',
            });

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    setFilteredUsers(filtered);
  }, [searchQuery, filterStatus, sortDirection, sortKey, users]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(current => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(key);
    setSortDirection('asc');
  };

  const renderSortableHeader = (label: string, key: SortKey) => {
    const isActive = sortKey === key;

    return (
      <button
        type="button"
        onClick={() => handleSort(key)}
        className="inline-flex items-center gap-1.5 rounded-md text-left font-bold text-black transition hover:text-[#1f6f68] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f68]/25"
        aria-label={`Sort by ${label} ${isActive && sortDirection === 'asc' ? 'descending' : 'ascending'}`}
      >
        <span>{label}</span>
        {isActive ? (
          sortDirection === 'asc' ? (
            <ArrowUp className="h-4 w-4 text-[#1f6f68]" />
          ) : (
            <ArrowDown className="h-4 w-4 text-[#1f6f68]" />
          )
        ) : (
          <ChevronsUpDown className="h-4 w-4 text-gray-400" />
        )}
      </button>
    );
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const deletePassengerAccount = async (user: User) => {
    const userName = user.name || 'this passenger';
    const confirmed = window.confirm(
      `Delete ${userName}?\n\nThis will remove the passenger user record and saved favorites. This cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingUserId(user.userId);

    try {
      await Promise.all([
        remove(ref(database, `users/${user.userId}`)),
        remove(ref(database, `passengerFavorites/${user.userId}`)),
      ]);

      alert(`${userName} has been deleted.`);
    } catch (error) {
      console.error('Error deleting passenger:', error);
      alert('Failed to delete passenger. Please try again.');
    } finally {
      setDeletingUserId(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <PasakayLoader size="page" label="Loading passengers" />
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
                  <th className="text-left py-4 px-6">{renderSortableHeader('Name', 'name')}</th>
                  <th className="text-left py-4 px-6">{renderSortableHeader('UID', 'uid')}</th>
                  <th className="text-left py-4 px-6">{renderSortableHeader('Contact', 'contact')}</th>
                  <th className="text-left py-4 px-6">{renderSortableHeader('Rating', 'rating')}</th>
                  <th className="text-left py-4 px-6">{renderSortableHeader('Total Trips', 'totalTrips')}</th>
                  <th className="text-left py-4 px-6">{renderSortableHeader('Status', 'status')}</th>
                  <th className="text-left py-4 px-6">{renderSortableHeader('Joined', 'joined')}</th>
                  <th className="text-left py-4 px-6 font-bold text-black">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-black font-semibold">
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
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-sm font-mono text-gray-800 break-all">{user.userId}</p>
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
                      <td className="py-4 px-6">
                        <button
                          onClick={() => deletePassengerAccount(user)}
                          disabled={deletingUserId === user.userId}
                          className="flex items-center space-x-1 px-3 py-1.5 bg-gray-800 hover:bg-black disabled:bg-gray-500 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          {deletingUserId === user.userId ? (
                            <>
                              <PasakayLoader size="button" label="Deleting passenger" />
                              <span>Deleting...</span>
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </>
                          )}
                        </button>
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
