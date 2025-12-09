'use client';

import { useEffect, useState } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { database } from '@/lib/firebase';
import { 
  Store, Search, CheckCircle, XCircle, Clock, Phone, Mail, 
  MapPin, Calendar, FileText, Eye, User, Star, ShoppingBag,
  AlertCircle, X
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';

interface Merchant {
  uid: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  category: string;
  status: string;
  logoUrl?: string;
  businessPermitUrl?: string;
  sanitaryPermitUrl?: string;
  description?: string;
  rating?: number;
  totalOrders?: number;
  isOpen?: boolean;
  createdAt: string;
  approvedAt?: string;
  rejectionReason?: string;
}

const categoryIcons: Record<string, string> = {
  restaurant: '🍽️',
  cafe: '☕',
  fastFood: '🍔',
  bakery: '🥐',
  desserts: '🍰',
  drinks: '🥤',
  grocery: '🛒',
};

export default function MerchantsPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [filteredMerchants, setFilteredMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<string | null>(null);

  useEffect(() => {
    const merchantsRef = ref(database, 'merchants');
    
    const unsubscribe = onValue(merchantsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const merchantList: Merchant[] = Object.keys(data).map(key => ({
          uid: key,
          ...data[key]
        }));
        setMerchants(merchantList);
      } else {
        setMerchants([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let filtered = merchants.filter(m => {
      const status = m.status?.toLowerCase() || 'pending';
      if (activeTab === 'pending') return status === 'pending';
      if (activeTab === 'approved') return status === 'approved';
      if (activeTab === 'rejected') return status === 'rejected' || status === 'suspended';
      return true;
    });

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(m => 
        m.businessName?.toLowerCase().includes(query) ||
        m.ownerName?.toLowerCase().includes(query) ||
        m.email?.toLowerCase().includes(query) ||
        m.phone?.includes(query)
      );
    }

    setFilteredMerchants(filtered);
  }, [merchants, activeTab, searchQuery]);

  const handleApprove = async (merchant: Merchant) => {
    if (!confirm(`Approve ${merchant.businessName}?`)) return;
    
    setProcessing(true);
    try {
      await update(ref(database, `merchants/${merchant.uid}`), {
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: 'admin',
      });
      
      await update(ref(database, `users/${merchant.uid}`), {
        isApproved: true,
      });
      
      alert(`${merchant.businessName} has been approved!`);
    } catch (error) {
      console.error('Error approving merchant:', error);
      alert('Failed to approve merchant');
    }
    setProcessing(false);
  };

  const handleReject = async () => {
    if (!selectedMerchant || !rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    
    setProcessing(true);
    try {
      await update(ref(database, `merchants/${selectedMerchant.uid}`), {
        status: 'rejected',
        rejectionReason: rejectionReason,
        rejectedAt: new Date().toISOString(),
      });
      
      await update(ref(database, `users/${selectedMerchant.uid}`), {
        isApproved: false,
      });
      
      alert(`${selectedMerchant.businessName} has been rejected.`);
      setShowRejectModal(false);
      setSelectedMerchant(null);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting merchant:', error);
      alert('Failed to reject merchant');
    }
    setProcessing(false);
  };

  const pendingCount = merchants.filter(m => m.status?.toLowerCase() === 'pending').length;
  const approvedCount = merchants.filter(m => m.status?.toLowerCase() === 'approved').length;
  const rejectedCount = merchants.filter(m => m.status?.toLowerCase() === 'rejected' || m.status?.toLowerCase() === 'suspended').length;

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getCategoryDisplay = (category: string) => {
    const icon = categoryIcons[category] || '🏪';
    const name = category?.charAt(0).toUpperCase() + category?.slice(1) || 'Unknown';
    return `${icon} ${name}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Merchant Management</h1>
            <p className="text-gray-600">Manage food delivery merchants and their applications</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search merchants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent w-64 text-gray-900"
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-3 font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'pending'
                  ? 'border-yellow-500 text-yellow-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Clock className="w-4 h-4" />
              Pending
              {pendingCount > 0 && (
                <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-xs font-semibold">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('approved')}
              className={`px-4 py-3 font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'approved'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              Approved
              <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs font-semibold">
                {approvedCount}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('rejected')}
              className={`px-4 py-3 font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'rejected'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <XCircle className="w-4 h-4" />
              Rejected
              <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-xs font-semibold">
                {rejectedCount}
              </span>
            </button>
          </nav>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : filteredMerchants.length === 0 ? (
          <div className="text-center py-16">
            <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No merchants found</h3>
            <p className="text-gray-500">
              {activeTab === 'pending' && 'No pending merchant applications'}
              {activeTab === 'approved' && 'No approved merchants yet'}
              {activeTab === 'rejected' && 'No rejected merchants'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredMerchants.map((merchant) => (
              <div
                key={merchant.uid}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                  {/* Logo & Basic Info */}
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      {merchant.logoUrl ? (
                        <img 
                          src={merchant.logoUrl} 
                          alt={merchant.businessName}
                          className="w-full h-full object-cover rounded-xl"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Store className="w-8 h-8 text-purple-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-semibold text-gray-900">{merchant.businessName}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          merchant.status === 'approved' 
                            ? 'bg-green-100 text-green-700'
                            : merchant.status === 'rejected' || merchant.status === 'suspended'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {merchant.status?.toUpperCase() || 'PENDING'}
                        </span>
                        {merchant.isOpen && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            OPEN
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{getCategoryDisplay(merchant.category)}</p>
                      
                      {/* Contact Info */}
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <User className="w-4 h-4" />
                          <span>{merchant.ownerName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="w-4 h-4" />
                          <span>{merchant.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail className="w-4 h-4" />
                          <span>{merchant.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="w-4 h-4" />
                          <span className="truncate">{merchant.address}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>Registered: {formatDate(merchant.createdAt)}</span>
                        </div>
                      </div>

                      {/* Stats for approved merchants */}
                      {merchant.status === 'approved' && (
                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex items-center gap-1 text-sm">
                            <Star className="w-4 h-4 text-yellow-500" />
                            <span className="font-medium">{merchant.rating?.toFixed(1) || '0.0'}</span>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <ShoppingBag className="w-4 h-4" />
                            <span>{merchant.totalOrders || 0} orders</span>
                          </div>
                        </div>
                      )}

                      {/* Rejection reason */}
                      {merchant.rejectionReason && (
                        <div className="mt-3 p-3 bg-red-50 rounded-lg">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                            <div>
                              <p className="text-xs font-medium text-red-700">Rejection Reason:</p>
                              <p className="text-sm text-red-600">{merchant.rejectionReason}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 lg:w-48">
                    {/* Documents */}
                    <div className="flex gap-2">
                      {merchant.businessPermitUrl && (
                        <button
                          onClick={() => setViewingDocument(merchant.businessPermitUrl!)}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          Permit
                        </button>
                      )}
                      {merchant.sanitaryPermitUrl && (
                        <button
                          onClick={() => setViewingDocument(merchant.sanitaryPermitUrl!)}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          Sanitary
                        </button>
                      )}
                    </div>

                    {/* Approve/Reject buttons for pending */}
                    {merchant.status?.toLowerCase() === 'pending' && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleApprove(merchant)}
                          disabled={processing}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setSelectedMerchant(merchant);
                            setShowRejectModal(true);
                          }}
                          disabled={processing}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    )}

                    {/* Reactivate for rejected */}
                    {(merchant.status?.toLowerCase() === 'rejected' || merchant.status?.toLowerCase() === 'suspended') && (
                      <button
                        onClick={() => handleApprove(merchant)}
                        disabled={processing}
                        className="flex items-center justify-center gap-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Reactivate
                      </button>
                    )}

                    {/* Suspend for approved */}
                    {merchant.status?.toLowerCase() === 'approved' && (
                      <button
                        onClick={() => {
                          setSelectedMerchant(merchant);
                          setShowRejectModal(true);
                        }}
                        disabled={processing}
                        className="flex items-center justify-center gap-1 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        Suspend
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Rejection Modal */}
        {showRejectModal && selectedMerchant && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedMerchant.status === 'approved' ? 'Suspend' : 'Reject'} Merchant
                </h3>
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setSelectedMerchant(null);
                    setRejectionReason('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <p className="text-gray-600 mb-4">
                {selectedMerchant.status === 'approved' 
                  ? `Are you sure you want to suspend ${selectedMerchant.businessName}?`
                  : `Please provide a reason for rejecting ${selectedMerchant.businessName}:`
                }
              </p>
              
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none text-gray-900"
                rows={3}
              />
              
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setSelectedMerchant(null);
                    setRejectionReason('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={processing || !rejectionReason.trim()}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {processing ? 'Processing...' : selectedMerchant.status === 'approved' ? 'Suspend' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Document Viewer Modal */}
        {viewingDocument && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="relative max-w-4xl w-full max-h-[90vh]">
              <button
                onClick={() => setViewingDocument(null)}
                className="absolute -top-10 right-0 text-white hover:text-gray-300"
              >
                <X className="w-8 h-8" />
              </button>
              <img
                src={viewingDocument}
                alt="Document"
                className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
              />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
