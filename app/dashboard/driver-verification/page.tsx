'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ref, onValue, update, get, off } from 'firebase/database';
import { database } from '@/lib/firebase';
import { User, Driver } from '@/types';
import { Search, CheckCircle, XCircle, Eye, Clock, FileText } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { createAdminNotification } from '@/lib/adminNotifications';
import { getStoredAdminSession } from '@/lib/adminSession';

interface DriverWithUser extends Driver {
  user?: User;
}

export default function DriverVerificationPage() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<DriverWithUser[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<DriverWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedDriver, setSelectedDriver] = useState<DriverWithUser | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [imageViewerUrl, setImageViewerUrl] = useState<string | null>(null);
  const [imageViewerTitle, setImageViewerTitle] = useState('');

  useEffect(() => {
    // Check if admin is logged in
    const adminUser = getStoredAdminSession();
    if (!adminUser) {
      router.push('/pasakay/login');
      return;
    }

    // Set up real-time listeners
    const driversRef = ref(database, 'drivers');
    const usersRef = ref(database, 'users');

    // Listen to drivers changes in real-time
    const unsubscribeDrivers = onValue(driversRef, async (driversSnapshot) => {
      try {
        // Get users data for driver info
        const usersSnapshot = await get(usersRef);

        if (driversSnapshot.exists()) {
          const driversData = driversSnapshot.val();
          const usersData = usersSnapshot.exists() ? usersSnapshot.val() : {};
          const driversList: DriverWithUser[] = [];

          Object.entries(driversData).forEach(([id, driver]: [string, any]) => {
            // Get user data for this driver - try both driver.userId and driver.uid
            const driverUserId = driver.userId || driver.uid || id;
            const userData = usersData[driverUserId];
            
            driversList.push({
              ...driver,
              driverId: id,
              userId: driverUserId,
              user: userData ? {
                ...userData,
                name: userData.name || 'N/A',
                phoneNumber: userData.phone || userData.phoneNumber || 'N/A',
                email: userData.email || 'N/A',
                profileImageUrl: userData.profileImage || userData.profileImageUrl,
              } : null,
              // Map Flutter field names to web-admin field names
              vehicleNumber: driver.vehicleNumber || 'N/A',
              vehicleModel: driver.vehicleModel || 'N/A',
              licenseNumber: driver.vehicleLicense || driver.licenseNumber || 'N/A',
              verificationStatus: driver.verificationStatus || driver.status || 'pending',
              // Fallback keys to avoid missing documents from older records
              driversLicenseUrl: driver.driversLicenseUrl || driver.driverLicenseUrl || driver.licenseUrl || '',
              orCrUrl: driver.orCrUrl || driver.vehicleOrCrUrl || driver.orcrUrl || '',
              validIdUrl: driver.validIdUrl || driver.validId || driver.idUrl || '',
            });
          });

          // Sort by verification status (pending first)
          driversList.sort((a, b) => {
            const statusOrder: any = { 'pending': 0, 'approved': 1, 'rejected': 2 };
            return statusOrder[a.verificationStatus || 'pending'] - statusOrder[b.verificationStatus || 'pending'];
          });

          setDrivers(driversList);
        } else {
          setDrivers([]);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error loading drivers:', error);
        setLoading(false);
      }
    });

    // Cleanup listener on unmount
    return () => {
      off(driversRef);
    };
  }, [router]);

  useEffect(() => {
    let filtered = drivers;

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(driver => driver.verificationStatus === filterStatus);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(driver =>
        driver.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        driver.vehicleNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        driver.licenseNumber?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredDrivers(filtered);
  }, [searchQuery, filterStatus, drivers]);

  const handleApprove = async (driver: DriverWithUser) => {
    if (!confirm(`Approve driver ${driver.user?.name}?`)) return;

    setProcessing(true);
    try {
      const adminUser = getStoredAdminSession();
      if (!adminUser) {
        router.push('/pasakay/login?expired=1');
        return;
      }
      const now = Date.now();

      const updates: any = {};
      
      // Update driver record
      updates[`drivers/${driver.driverId}/verificationStatus`] = 'approved';
      updates[`drivers/${driver.driverId}/isApproved`] = true;
      // Also set the main status field so the mobile app sees driver as approved
      updates[`drivers/${driver.driverId}/status`] = 'approved';
      updates[`drivers/${driver.driverId}/approvedAt`] = now;
      updates[`drivers/${driver.driverId}/verifiedBy`] = adminUser.userId;
      updates[`drivers/${driver.driverId}/verifiedAt`] = now;
      // Drivers must activate a paid subscription before accepting trips.
      updates[`drivers/${driver.driverId}/hasActiveSubscription`] = false;
      updates[`drivers/${driver.driverId}/subscriptionStatus`] = 'none';
      updates[`drivers/${driver.driverId}/subscriptionType`] = null;
      updates[`drivers/${driver.driverId}/subscriptionPlan`] = null;
      updates[`drivers/${driver.driverId}/subscriptionStartDate`] = null;
      updates[`drivers/${driver.driverId}/subscriptionEndDate`] = null;
      updates[`drivers/${driver.driverId}/subscriptionExpiry`] = null;

      // Update user record
      updates[`users/${driver.userId}/verificationStatus`] = 'approved';
      updates[`users/${driver.userId}/isApproved`] = true;
      updates[`users/${driver.userId}/verifiedBy`] = adminUser.userId;
      updates[`users/${driver.userId}/verifiedAt`] = now;

      await update(ref(database), updates);

      await createAdminNotification({
        title: 'Driver Approved',
        message: `${driver.user?.name || driver.name || 'A driver'} was approved by admin.`,
        type: 'driverVerified',
        relatedId: driver.driverId,
      });

      alert('Driver approved successfully!');
    } catch (error) {
      console.error('Error approving driver:', error);
      alert('Failed to approve driver');
    }
    setProcessing(false);
  };

  const handleReject = async () => {
    if (!selectedDriver || !rejectionReason.trim()) {
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
      
      // Update driver record
      updates[`drivers/${selectedDriver.driverId}/verificationStatus`] = 'rejected';
      updates[`drivers/${selectedDriver.driverId}/isApproved`] = false;
      updates[`drivers/${selectedDriver.driverId}/status`] = 'rejected';
      updates[`drivers/${selectedDriver.driverId}/rejectionReason`] = rejectionReason;
      updates[`drivers/${selectedDriver.driverId}/verifiedBy`] = adminUser.userId;
      updates[`drivers/${selectedDriver.driverId}/verifiedAt`] = now;

      // Update user record
      updates[`users/${selectedDriver.userId}/verificationStatus`] = 'rejected';
      updates[`users/${selectedDriver.userId}/isApproved`] = false;
      updates[`users/${selectedDriver.userId}/rejectionReason`] = rejectionReason;
      updates[`users/${selectedDriver.userId}/verifiedBy`] = adminUser.userId;
      updates[`users/${selectedDriver.userId}/verifiedAt`] = now;

      await update(ref(database), updates);

      await createAdminNotification({
        title: 'Driver Rejected',
        message: `${selectedDriver.user?.name || selectedDriver.name || 'A driver'} was rejected by admin.`,
        type: 'driverRejected',
        relatedId: selectedDriver.driverId,
      });

      alert('Driver rejected');
      setShowModal(false);
      setRejectionReason('');
      setSelectedDriver(null);
    } catch (error) {
      console.error('Error rejecting driver:', error);
      alert('Failed to reject driver');
    }
    setProcessing(false);
  };

  const openRejectModal = (driver: DriverWithUser) => {
    setSelectedDriver(driver);
    setShowModal(true);
  };

  const viewDocument = (url: string, title: string) => {
    if (!url) {
      alert('Document not available');
      return;
    }
    setImageViewerUrl(url);
    setImageViewerTitle(title);
  };

  const closeImageViewer = () => {
    setImageViewerUrl(null);
    setImageViewerTitle('');
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
      'pending': 'bg-yellow-100 text-yellow-800',
      'approved': 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badges[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
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
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Driver Verification</h1>
            <p className="text-gray-600">Review and approve driver applications</p>
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
                <p className="text-gray-600 text-sm mb-1">Pending</p>
                <p className="text-3xl font-bold text-yellow-600">
                  {drivers.filter(d => d.verificationStatus === 'pending').length}
                </p>
              </div>
              <Clock className="w-12 h-12 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Approved</p>
                <p className="text-3xl font-bold text-green-600">
                  {drivers.filter(d => d.verificationStatus === 'approved').length}
                </p>
              </div>
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Rejected</p>
                <p className="text-3xl font-bold text-red-600">
                  {drivers.filter(d => d.verificationStatus === 'rejected').length}
                </p>
              </div>
              <XCircle className="w-12 h-12 text-red-500" />
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
                placeholder="Search by name, vehicle, or license..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-black font-semibold placeholder-gray-400"
              />
            </div>

            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-black font-semibold"
              >
                <option value="pending">Pending Only</option>
                <option value="all">All Applications</option>
                <option value="approved">Approved Only</option>
                <option value="rejected">Rejected Only</option>
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
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Vehicle</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">License</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Documents</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500">
                      No drivers found
                    </td>
                  </tr>
                ) : (
                  filteredDrivers.map((driver) => (
                    <tr key={driver.driverId} className="border-b hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold">
                              {driver.user?.name?.charAt(0).toUpperCase() || 'D'}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">{driver.user?.name || 'N/A'}</p>
                            <p className="text-sm text-gray-500">{driver.user?.phoneNumber || 'N/A'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div>
                          <p className="font-semibold text-gray-800">{driver.vehicleNumber || 'N/A'}</p>
                          <p className="text-sm text-gray-500">{driver.vehicleModel || 'N/A'}</p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-gray-700">{driver.licenseNumber || 'N/A'}</span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => viewDocument(driver.driversLicenseUrl || '', "Driver's License")}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-200 flex items-center space-x-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>License</span>
                          </button>
                          <button
                            onClick={() => viewDocument(driver.orCrUrl || '', 'OR/CR')}
                            className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-200 flex items-center space-x-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>OR/CR</span>
                          </button>
                          <button
                            onClick={() => viewDocument(driver.validIdUrl || '', 'Valid ID')}
                            className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold hover:bg-purple-200 flex items-center space-x-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>ID</span>
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {getStatusBadge(driver.verificationStatus || 'pending')}
                        {driver.verificationStatus === 'rejected' && driver.rejectionReason && (
                          <p className="text-xs text-red-600 mt-1">{driver.rejectionReason}</p>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {driver.verificationStatus === 'pending' && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleApprove(driver)}
                              disabled={processing}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center space-x-1"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => openRejectModal(driver)}
                              disabled={processing}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center space-x-1"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Reject</span>
                            </button>
                          </div>
                        )}
                        {driver.verificationStatus === 'approved' && (
                          <span className="text-sm text-gray-500">
                            Verified {formatDate(driver.verifiedAt || 0)}
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
          Showing {filteredDrivers.length} of {drivers.length} applications
        </div>
      </div>

      {/* Rejection Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Reject Driver Application</h3>
            <p className="text-gray-600 mb-4">
              Driver: <span className="font-semibold">{selectedDriver?.user?.name}</span>
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none mb-4"
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
                  setShowModal(false);
                  setRejectionReason('');
                  setSelectedDriver(null);
                }}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 disabled:opacity-50"
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
                <h3 className="text-lg font-bold text-gray-800">{imageViewerTitle}</h3>
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
                  alt={imageViewerTitle}
                  className="max-w-full max-h-[70vh] mx-auto object-contain rounded-lg shadow-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="%23f3f4f6" width="400" height="300"/><text fill="%236b7280" font-family="Arial" font-size="16" x="50%" y="50%" text-anchor="middle" dy=".3em">Image not available</text></svg>';
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
