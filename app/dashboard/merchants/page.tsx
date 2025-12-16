'use client';

import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, update, set } from 'firebase/database';
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
  subscriptionPlan?: string;
  subscriptionExpiry?: string;
  hasActiveSubscription?: boolean;
}

interface MerchantSubscriptionSettingsForm {
  oneMonthPrice: string;
  threeMonthsPrice: string;
  oneMonthDays: string;
  threeMonthsDays: string;
  requireActiveSubscription: boolean;
}

const defaultMerchantSubscriptionSettings: MerchantSubscriptionSettingsForm = {
  oneMonthPrice: '1000',
  threeMonthsPrice: '2000',
  oneMonthDays: '30',
  threeMonthsDays: '90',
  requireActiveSubscription: true,
};

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
  const [subscriptionLoading, setSubscriptionLoading] = useState<string | null>(null);
  const [subscriptionSettings, setSubscriptionSettings] = useState<MerchantSubscriptionSettingsForm>(defaultMerchantSubscriptionSettings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const numericSettings = useMemo(() => ({
    oneMonthPrice: Number(subscriptionSettings.oneMonthPrice) || 0,
    threeMonthsPrice: Number(subscriptionSettings.threeMonthsPrice) || 0,
    oneMonthDays: Number(subscriptionSettings.oneMonthDays) || 0,
    threeMonthsDays: Number(subscriptionSettings.threeMonthsDays) || 0,
  }), [subscriptionSettings]);
  const formatPrice = (value: number) =>
    `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

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
    const settingsRef = ref(database, 'settings/merchantSubscription');
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setSubscriptionSettings({
          oneMonthPrice: String(data.oneMonthPrice ?? defaultMerchantSubscriptionSettings.oneMonthPrice),
          threeMonthsPrice: String(data.threeMonthsPrice ?? defaultMerchantSubscriptionSettings.threeMonthsPrice),
          oneMonthDays: String(data.oneMonthDays ?? defaultMerchantSubscriptionSettings.oneMonthDays),
          threeMonthsDays: String(data.threeMonthsDays ?? defaultMerchantSubscriptionSettings.threeMonthsDays),
          requireActiveSubscription:
              data.requireActiveSubscription ?? defaultMerchantSubscriptionSettings.requireActiveSubscription,
        });
      } else {
        setSubscriptionSettings(defaultMerchantSubscriptionSettings);
      }
      setSettingsLoaded(true);
    }, (error) => {
      console.error('Error loading subscription settings:', error);
      setSettingsLoaded(true);
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
    if (!selectedMerchant) return;
    const isSuspending = selectedMerchant.status?.toLowerCase() === 'approved';
    if (!isSuspending && !rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    setProcessing(true);
    try {
      const statusValue = isSuspending ? 'suspended' : 'rejected';
      await update(ref(database, `merchants/${selectedMerchant.uid}`), {
        status: statusValue,
        rejectionReason: rejectionReason.trim() || (isSuspending ? 'Suspended by admin' : undefined),
        rejectedAt: !isSuspending ? new Date().toISOString() : undefined,
        suspendedAt: isSuspending ? new Date().toISOString() : undefined,
        hasActiveSubscription: false,
      });

      await update(ref(database, `users/${selectedMerchant.uid}`), {
        isApproved: statusValue === 'approved',
      });

      alert(
        `${selectedMerchant.businessName} has been ${isSuspending ? 'suspended' : 'rejected'}.`,
      );
      setShowRejectModal(false);
      setSelectedMerchant(null);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting merchant:', error);
      alert('Failed to update merchant status');
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

  const handleSettingsInputChange = (
    field: 'oneMonthPrice' | 'threeMonthsPrice' | 'oneMonthDays' | 'threeMonthsDays',
    value: string,
  ) => {
    setSubscriptionSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveSubscriptionSettings = async () => {
    setSavingSettings(true);
    try {
      await set(ref(database, 'settings/merchantSubscription'), {
        oneMonthPrice: numericSettings.oneMonthPrice,
        threeMonthsPrice: numericSettings.threeMonthsPrice,
        oneMonthDays: numericSettings.oneMonthDays,
        threeMonthsDays: numericSettings.threeMonthsDays,
        requireActiveSubscription: subscriptionSettings.requireActiveSubscription,
        updatedAt: new Date().toISOString(),
      });
      alert('Merchant subscription settings saved!');
    } catch (error) {
      console.error('Error saving subscription settings:', error);
      alert('Failed to save subscription settings');
    }
    setSavingSettings(false);
  };

  const getPlanConfig = (plan: 'oneMonth' | 'threeMonths') => ({
    price: plan === 'oneMonth' ? numericSettings.oneMonthPrice : numericSettings.threeMonthsPrice,
    days: plan === 'oneMonth' ? numericSettings.oneMonthDays : numericSettings.threeMonthsDays,
  });

  const activateSubscription = async (merchant: Merchant, plan: 'oneMonth' | 'threeMonths') => {
    try {
      setSubscriptionLoading(merchant.uid);
      const planConfig = getPlanConfig(plan);
      const fallbackDuration = plan === 'oneMonth' ? 30 : 90;
      const durationDays = planConfig.days > 0 ? planConfig.days : fallbackDuration;
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + durationDays);

      await update(ref(database, `merchants/${merchant.uid}`), {
        subscriptionPlan: plan,
        subscriptionExpiry: expiry.toISOString(),
        hasActiveSubscription: true,
        subscriptionUpdatedAt: new Date().toISOString(),
      });
      const planLabel = plan === 'oneMonth' ? '1 month' : '3 months';
      alert(`${merchant.businessName} subscription activated (${planLabel})`);
    } catch (error) {
      console.error('Error updating subscription:', error);
      alert('Failed to update subscription');
    }
    setSubscriptionLoading(null);
  };

  const suspendSubscription = async (merchant: Merchant) => {
    try {
      setSubscriptionLoading(merchant.uid);
      await update(ref(database, `merchants/${merchant.uid}`), {
        hasActiveSubscription: false,
      });
      alert(`${merchant.businessName} subscription suspended`);
    } catch (error) {
      console.error('Error suspending subscription:', error);
      alert('Failed to suspend subscription');
    }
    setSubscriptionLoading(null);
  };

  const getSubscriptionStatus = (merchant: Merchant) => {
    const expiryDate = merchant.subscriptionExpiry ? new Date(merchant.subscriptionExpiry) : null;
    const daysRemaining =
      expiryDate ? Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

    if (merchant.hasActiveSubscription && expiryDate && daysRemaining !== null && daysRemaining >= 0) {
      return {
        label: 'Active',
        badgeClass: 'text-green-700 bg-green-100 border-green-200',
        description: `Expires ${expiryDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} (${daysRemaining} days left)`,
      };
    }

    if (expiryDate) {
      return {
        label: 'Expired',
        badgeClass: 'text-yellow-700 bg-yellow-50 border-yellow-200',
        description: `Expired ${expiryDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      };
    }

    return {
      label: 'No subscription',
      badgeClass: 'text-gray-600 bg-gray-50 border-gray-200',
      description: subscriptionSettings.requireActiveSubscription
        ? 'Activate a plan so this merchant can receive orders.'
        : 'Optional — activate a plan for better marketplace placement.',
    };
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

        {/* Subscription Settings */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Merchant Subscription Settings</h2>
              <p className="text-gray-600 text-sm">Update plan pricing, duration, and requirement in real-time.</p>
            </div>
            <button
              onClick={handleSaveSubscriptionSettings}
              disabled={!settingsLoaded || savingSettings}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-60"
            >
              {savingSettings ? 'Saving...' : 'Save settings'}
            </button>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">1 Month Plan</p>
                <p className="text-xs text-gray-500">Best for new or seasonal partners.</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">Price (PHP)</label>
                <input
                  type="number"
                  min="0"
                  value={subscriptionSettings.oneMonthPrice}
                  onChange={(e) => handleSettingsInputChange('oneMonthPrice', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">Duration (days)</label>
                <input
                  type="number"
                  min="1"
                  value={subscriptionSettings.oneMonthDays}
                  onChange={(e) => handleSettingsInputChange('oneMonthDays', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                />
              </div>
              <p className="text-xs text-gray-500">
                Merchants pay {formatPrice(numericSettings.oneMonthPrice || 0)} for {numericSettings.oneMonthDays || 0} days.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">3 Months Plan</p>
                <p className="text-xs text-gray-500">Longer commitment with better savings.</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">Price (PHP)</label>
                <input
                  type="number"
                  min="0"
                  value={subscriptionSettings.threeMonthsPrice}
                  onChange={(e) => handleSettingsInputChange('threeMonthsPrice', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">Duration (days)</label>
                <input
                  type="number"
                  min="1"
                  value={subscriptionSettings.threeMonthsDays}
                  onChange={(e) => handleSettingsInputChange('threeMonthsDays', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                />
              </div>
              <p className="text-xs text-gray-500">
                Merchants pay {formatPrice(numericSettings.threeMonthsPrice || 0)} for {numericSettings.threeMonthsDays || 0} days.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={subscriptionSettings.requireActiveSubscription}
                onChange={(e) =>
                  setSubscriptionSettings((prev) => ({
                    ...prev,
                    requireActiveSubscription: e.target.checked,
                  }))
                }
                className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700">
                <span className="block font-semibold text-gray-900">Require active subscription</span>
                {subscriptionSettings.requireActiveSubscription ? (
                  <span className="text-gray-600">
                    Merchants without a valid plan are hidden from passengers and food ordering.
                  </span>
                ) : (
                  <span className="text-gray-600">
                    Merchants remain visible even if their plan expires (useful during promos).
                  </span>
                )}
              </span>
            </label>
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
            {filteredMerchants.map((merchant) => {
              const subscription = getSubscriptionStatus(merchant);
              const isSubscriptionUpdating = subscriptionLoading === merchant.uid;
              return (
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

                      {/* Subscription */}
                      <div className={`mt-4 p-3 rounded-lg border ${subscription.badgeClass}`}>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-gray-800">Subscription</p>
                          <span className="text-xs font-semibold">{subscription.label}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{subscription.description}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button
                          onClick={() => activateSubscription(merchant, 'oneMonth')}
                          disabled={isSubscriptionUpdating}
                          className="px-3 py-2 text-sm rounded-lg border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 disabled:opacity-60"
                        >
                          {isSubscriptionUpdating
                            ? 'Updating...'
                            : `Activate 1 mo (${formatPrice(getPlanConfig('oneMonth').price || 0)})`}
                        </button>
                        <button
                          onClick={() => activateSubscription(merchant, 'threeMonths')}
                          disabled={isSubscriptionUpdating}
                          className="px-3 py-2 text-sm rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-60"
                        >
                          {`Activate 3 mo (${formatPrice(getPlanConfig('threeMonths').price || 0)})`}
                        </button>
                        {merchant.hasActiveSubscription && (
                          <button
                            onClick={() => suspendSubscription(merchant)}
                            disabled={isSubscriptionUpdating}
                            className="px-3 py-2 text-sm rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-60"
                          >
                            Suspend
                          </button>
                        )}
                      </div>

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
              );
            })}
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
