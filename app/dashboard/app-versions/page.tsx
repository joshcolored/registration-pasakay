'use client';

import { useEffect, useState } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { database } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Smartphone, Download, Save, AlertCircle, CheckCircle, Info, Bell, Send } from 'lucide-react';
import { getStoredAdminSession } from '@/lib/adminSession';

interface AppVersionConfig {
  latestVersion: string;
  latestBuildNumber: number;
  minVersion: string;
  minBuildNumber: number;
  downloadUrl: string;
  releaseNotes: string;
  forceUpdate: boolean;
  updatedAt: string;
  notifyTimestamp?: string;
}

interface AppConfig {
  passenger: AppVersionConfig;
  driver: AppVersionConfig;
}

const defaultConfig: AppVersionConfig = {
  latestVersion: '1.0.0',
  latestBuildNumber: 1,
  minVersion: '1.0.0',
  minBuildNumber: 1,
  downloadUrl: '',
  releaseNotes: '',
  forceUpdate: false,
  updatedAt: new Date().toISOString(),
};

export default function AppVersionsPage() {
  const router = useRouter();
  const [config, setConfig] = useState<AppConfig>({
    passenger: { ...defaultConfig },
    driver: { ...defaultConfig },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'passenger' | 'driver' | null>(null);
  const [success, setSuccess] = useState<'passenger' | 'driver' | null>(null);
  const [notifying, setNotifying] = useState<'passenger' | 'driver' | null>(null);
  const [notifySuccess, setNotifySuccess] = useState<'passenger' | 'driver' | null>(null);

  useEffect(() => {
    const adminUser = getStoredAdminSession();
    if (!adminUser) {
      router.push('/pasakay/login');
      return;
    }

    const configRef = ref(database, 'app_config');
    const unsubscribe = onValue(configRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setConfig({
          passenger: { ...defaultConfig, ...(data.passenger || {}) },
          driver: { ...defaultConfig, ...(data.driver || {}) },
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleSave = async (appType: 'passenger' | 'driver') => {
    setSaving(appType);
    setSuccess(null);

    try {
      const configRef = ref(database, `app_config/${appType}`);
      await set(configRef, {
        ...config[appType],
        updatedAt: new Date().toISOString(),
      });
      setSuccess(appType);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Error saving configuration. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const updateConfig = (
    appType: 'passenger' | 'driver',
    field: keyof AppVersionConfig,
    value: string | number | boolean
  ) => {
    setConfig((prev) => ({
      ...prev,
      [appType]: {
        ...prev[appType],
        [field]: value,
      },
    }));
  };

  const handleNotifyUsers = async (appType: 'passenger' | 'driver') => {
    setNotifying(appType);
    setNotifySuccess(null);

    try {
      const configRef = ref(database, `app_config/${appType}`);
      await set(configRef, {
        ...config[appType],
        notifyTimestamp: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setNotifySuccess(appType);
      setTimeout(() => setNotifySuccess(null), 3000);
      alert(`Update notification sent to all ${appType}s! They will see the popup when they open the app.`);
    } catch (error) {
      console.error('Error notifying users:', error);
      alert('Error sending notification. Please try again.');
    } finally {
      setNotifying(null);
    }
  };

  const renderVersionCard = (appType: 'passenger' | 'driver', title: string, icon: React.ReactNode) => {
    const appConfig = config[appType];
    const isSaving = saving === appType;
    const isSuccess = success === appType;
    const isNotifying = notifying === appType;
    const isNotifySuccess = notifySuccess === appType;

    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className={`p-3 rounded-lg ${appType === 'passenger' ? 'bg-blue-100' : 'bg-green-100'}`}>
            {icon}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
            <p className="text-sm text-gray-500">
              Last updated: {appConfig.updatedAt ? new Date(appConfig.updatedAt).toLocaleString() : 'Never'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Latest Version *
              </label>
              <input
                type="text"
                value={appConfig.latestVersion}
                onChange={(e) => updateConfig(appType, 'latestVersion', e.target.value)}
                placeholder="e.g., 1.2.0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
              />
              <p className="text-xs text-gray-500 mt-1">Users will be notified about this version</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Latest Build Number *
              </label>
              <input
                type="number"
                min="1"
                value={appConfig.latestBuildNumber || 1}
                onChange={(e) => updateConfig(appType, 'latestBuildNumber', parseInt(e.target.value) || 1)}
                placeholder="e.g., 14"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
              />
              <p className="text-xs text-gray-500 mt-1">Must match Play Store versionCode/build number</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Required Version *
              </label>
              <input
                type="text"
                value={appConfig.minVersion}
                onChange={(e) => updateConfig(appType, 'minVersion', e.target.value)}
                placeholder="e.g., 1.0.0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
              />
              <p className="text-xs text-gray-500 mt-1">Users below this version will be forced to update</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Build Number *
              </label>
              <input
                type="number"
                min="1"
                value={appConfig.minBuildNumber || 1}
                onChange={(e) => updateConfig(appType, 'minBuildNumber', parseInt(e.target.value) || 1)}
                placeholder="e.g., 13"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
              />
              <p className="text-xs text-gray-500 mt-1">Users below this build are blocked until they update</p>
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4">
            <input
              type="checkbox"
              checked={!!appConfig.forceUpdate}
              onChange={(e) => updateConfig(appType, 'forceUpdate', e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            />
            <span>
              <span className="block text-sm font-semibold text-orange-900">Force update enabled</span>
              <span className="block text-xs text-orange-800">
                Keep this on only when older builds cannot safely continue.
              </span>
            </span>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Download URL *
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={appConfig.downloadUrl}
                onChange={(e) => updateConfig(appType, 'downloadUrl', e.target.value)}
                placeholder="https://play.google.com/store/apps/details?id=your.package.name"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
              />
              {appConfig.downloadUrl && (
                <a
                  href={appConfig.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 flex items-center gap-1"
                >
                  <Download className="w-4 h-4" />
                  Test
                </a>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Release Notes
            </label>
            <textarea
              value={appConfig.releaseNotes}
              onChange={(e) => updateConfig(appType, 'releaseNotes', e.target.value)}
              placeholder="What's new in this version..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            {(isSuccess || isNotifySuccess) && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span>{isNotifySuccess ? 'Notification sent!' : 'Saved successfully!'}</span>
              </div>
            )}
            {!isSuccess && !isNotifySuccess && <div />}
            
            <div className="flex gap-2">
              <button
                onClick={() => handleSave(appType)}
                disabled={isSaving || isNotifying}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium ${
                  appType === 'passenger'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-green-600 hover:bg-green-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              
              <button
                onClick={() => handleNotifyUsers(appType)}
                disabled={isSaving || isNotifying || !appConfig.downloadUrl}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                title={!appConfig.downloadUrl ? 'Please set a download URL first' : 'Send update notification to all users'}
              >
                <Send className="w-4 h-4" />
                {isNotifying ? 'Sending...' : 'Notify Users'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">App Version Management</h1>
          <p className="text-gray-600 mt-1">
            Manage app versions and notify users about updates
          </p>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">How it works:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li><strong>Latest Version:</strong> Users will see an optional update popup if their version is lower</li>
              <li><strong>Latest Build Number:</strong> Used for optional update prompts</li>
              <li><strong>Minimum Build Number:</strong> Users below this build are blocked until they update</li>
              <li><strong>Download URL:</strong> Use the Google Play Store app URL</li>
            </ul>
          </div>
        </div>

        {/* Version Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {renderVersionCard(
            'passenger',
            'Passenger App',
            <Smartphone className="w-6 h-6 text-blue-600" />
          )}
          {renderVersionCard(
            'driver',
            'Driver App',
            <Smartphone className="w-6 h-6 text-green-600" />
          )}
        </div>

        {/* Warning */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <p className="font-medium">Important Notes:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Version format should be semantic (e.g., 1.0.0, 1.2.3)</li>
              <li>Build numbers should match Flutter build-number / Android versionCode</li>
              <li>Make sure the Play Store URL is accessible before updating</li>
              <li>Force updates should only be used for critical updates</li>
            </ul>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
