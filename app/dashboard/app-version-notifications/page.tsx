'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onValue, push, ref, set } from 'firebase/database';
import {
  BellRing,
  CheckCircle,
  Clock,
  ExternalLink,
  History,
  Send,
  Smartphone,
  Users,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import PasakayLoader from '@/components/PasakayLoader';
import { database } from '@/lib/firebase';
import { getStoredAdminSession } from '@/lib/adminSession';

type Audience = 'all' | 'passenger' | 'driver';
type Platform = 'both' | 'android' | 'ios';

type VersionNotification = {
  notificationId: string;
  title: string;
  message: string;
  version: string;
  audience: Audience;
  platform: Platform;
  playStoreUrl?: string;
  appStoreUrl?: string;
  forceUpdate: boolean;
  active: boolean;
  pushRequested: boolean;
  status: 'queued';
  createdAt: string;
  createdBy: string;
  createdByName?: string;
};

const initialForm = {
  title: 'A new Pasakay update is available',
  message: 'Download the latest version for new features, improvements, and important fixes.',
  version: '',
  audience: 'all' as Audience,
  platform: 'both' as Platform,
  playStoreUrl: '',
  appStoreUrl: '',
  forceUpdate: false,
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function AppVersionNotificationsPage() {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [notifications, setNotifications] = useState<VersionNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const adminUser = getStoredAdminSession();
    if (!adminUser) {
      router.push('/pasakay/login');
      return;
    }

    const notificationsRef = ref(database, 'app_version_notifications');
    const unsubscribe = onValue(
      notificationsRef,
      (snapshot) => {
        const list: VersionNotification[] = [];
        if (snapshot.exists()) {
          Object.values<VersionNotification>(snapshot.val()).forEach((notification) => {
            list.push(notification);
          });
        }
        list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        setNotifications(list);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading app version notifications:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [router]);

  const stats = useMemo(
    () => ({
      total: notifications.length,
      allUsers: notifications.filter((item) => item.audience === 'all').length,
      forced: notifications.filter((item) => item.forceUpdate).length,
      latest: notifications[0]?.createdAt,
    }),
    [notifications]
  );

  const updateField = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccessMessage('');

    const requiresPlayStore = form.platform === 'both' || form.platform === 'android';
    const requiresAppStore = form.platform === 'both' || form.platform === 'ios';

    if (!form.title.trim() || !form.message.trim() || !form.version.trim()) {
      alert('Title, message, and version are required.');
      return;
    }
    if (requiresPlayStore && !form.playStoreUrl.trim()) {
      alert('Please provide the Google Play Store URL.');
      return;
    }
    if (requiresAppStore && !form.appStoreUrl.trim()) {
      alert('Please provide the Apple App Store URL.');
      return;
    }

    const adminUser = getStoredAdminSession();
    if (!adminUser) {
      router.push('/pasakay/login?expired=1');
      return;
    }

    setSending(true);
    try {
      const notificationRef = push(ref(database, 'app_version_notifications'));
      const notificationId = notificationRef.key || `version_${Date.now()}`;
      const payload: VersionNotification = {
        notificationId,
        title: form.title.trim(),
        message: form.message.trim(),
        version: form.version.trim(),
        audience: form.audience,
        platform: form.platform,
        playStoreUrl: requiresPlayStore ? form.playStoreUrl.trim() : '',
        appStoreUrl: requiresAppStore ? form.appStoreUrl.trim() : '',
        forceUpdate: form.forceUpdate,
        active: true,
        pushRequested: true,
        status: 'queued',
        createdAt: new Date().toISOString(),
        createdBy: adminUser.userId,
        createdByName: adminUser.name || adminUser.email,
      };

      await set(notificationRef, payload);
      setSuccessMessage('Version notification queued successfully.');
      setForm((current) => ({
        ...initialForm,
        playStoreUrl: current.playStoreUrl,
        appStoreUrl: current.appStoreUrl,
      }));
      window.setTimeout(() => setSuccessMessage(''), 4000);
    } catch (error) {
      console.error('Error creating app version notification:', error);
      alert('Unable to queue the notification. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <PasakayLoader size="page" label="Loading version notifications" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="admin-modern-page">
        <div className="admin-modern-header">
          <div>
            <p className="admin-modern-eyebrow">App version notifications</p>
            <h1>Update Notification Campaign</h1>
            <p>
              Queue an app update message for passengers, drivers, or everyone using Android and iOS.
            </p>
          </div>
          <div className="admin-modern-live">Firebase connected</div>
        </div>

        <div className="admin-modern-stats grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p>Total campaigns</p>
              <p className="text-2xl">{stats.total}</p>
            </div>
            <BellRing />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p>All users</p>
              <p className="text-2xl">{stats.allUsers}</p>
            </div>
            <Users />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p>Required updates</p>
              <p className="text-2xl">{stats.forced}</p>
            </div>
            <Smartphone />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p>Last queued</p>
              <p className="text-base">{stats.latest ? formatDate(stats.latest) : 'Never'}</p>
            </div>
            <Clock />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <form onSubmit={handleSubmit} className="admin-modern-section p-5 sm:p-6">
            <div className="mb-6">
              <h2 className="text-xl font-black text-[#18211f]">Compose notification</h2>
              <p className="mt-1 text-sm text-[#66736f]">
                This creates a queued notification record in Firebase Realtime Database.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-black text-[#49534f]">Notification title</span>
                <input
                  value={form.title}
                  onChange={(event) => updateField('title', event.target.value)}
                  maxLength={80}
                  className="w-full rounded-md border px-4 py-3 outline-none"
                  placeholder="A new Pasakay update is available"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-black text-[#49534f]">Message</span>
                <textarea
                  value={form.message}
                  onChange={(event) => updateField('message', event.target.value)}
                  maxLength={240}
                  rows={4}
                  className="w-full rounded-md border px-4 py-3 outline-none"
                  placeholder="Tell users what is included in the update."
                />
                <span className="mt-1 block text-right text-xs font-semibold text-[#89918d]">
                  {form.message.length}/240
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-[#49534f]">New version</span>
                <input
                  value={form.version}
                  onChange={(event) => updateField('version', event.target.value)}
                  className="w-full rounded-md border px-4 py-3 outline-none"
                  placeholder="e.g. 1.4.0"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-[#49534f]">Audience</span>
                <select
                  value={form.audience}
                  onChange={(event) => updateField('audience', event.target.value as Audience)}
                  className="w-full rounded-md border px-4 py-3 outline-none"
                >
                  <option value="all">All app users</option>
                  <option value="passenger">Passengers only</option>
                  <option value="driver">Drivers only</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-[#49534f]">Platform</span>
                <select
                  value={form.platform}
                  onChange={(event) => updateField('platform', event.target.value as Platform)}
                  className="w-full rounded-md border px-4 py-3 outline-none"
                >
                  <option value="both">Android and iOS</option>
                  <option value="android">Android only</option>
                  <option value="ios">iOS only</option>
                </select>
              </label>

              <label className="flex items-center gap-3 rounded-md border border-[#ead8aa] bg-[#fff9e9] px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.forceUpdate}
                  onChange={(event) => updateField('forceUpdate', event.target.checked)}
                  className="h-4 w-4 accent-[#1f6f68]"
                />
                <span>
                  <span className="block text-sm font-black text-[#73510b]">Required update</span>
                  <span className="block text-xs text-[#8a6b28]">Tell the app to prevent dismissal.</span>
                </span>
              </label>

              {(form.platform === 'both' || form.platform === 'android') && (
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-black text-[#49534f]">Google Play Store URL</span>
                  <input
                    type="url"
                    value={form.playStoreUrl}
                    onChange={(event) => updateField('playStoreUrl', event.target.value)}
                    className="w-full rounded-md border px-4 py-3 outline-none"
                    placeholder="https://play.google.com/store/apps/details?id=..."
                  />
                </label>
              )}

              {(form.platform === 'both' || form.platform === 'ios') && (
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-black text-[#49534f]">Apple App Store URL</span>
                  <input
                    type="url"
                    value={form.appStoreUrl}
                    onChange={(event) => updateField('appStoreUrl', event.target.value)}
                    className="w-full rounded-md border px-4 py-3 outline-none"
                    placeholder="https://apps.apple.com/app/..."
                  />
                </label>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#dfe5e1] pt-5">
              <div className="min-h-6">
                {successMessage && (
                  <p className="flex items-center gap-2 text-sm font-black text-[#1f6f68]">
                    <CheckCircle className="h-5 w-5" />
                    {successMessage}
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={sending}
                className="inline-flex items-center gap-2 rounded-md bg-[#1f6f68] px-5 py-3 text-sm font-black text-white transition hover:bg-[#174c49] disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {sending ? 'Queuing...' : 'Queue notification'}
              </button>
            </div>
          </form>

          <div className="admin-modern-section overflow-hidden">
            <div className="flex items-center gap-3 border-b border-[#dfe5e1] px-5 py-4">
              <History className="h-5 w-5 text-[#1f6f68]" />
              <div>
                <h2 className="font-black text-[#18211f]">Campaign history</h2>
                <p className="text-xs font-semibold text-[#66736f]">Newest notifications appear first.</p>
              </div>
            </div>

            <div className="max-h-[760px] divide-y divide-[#edf0eb] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <BellRing className="mx-auto h-8 w-8 text-[#9ca5a1]" />
                  <p className="mt-3 text-sm font-bold text-[#66736f]">No campaigns queued yet.</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <article key={notification.notificationId} className="p-5 hover:bg-[#f9faf7]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-black text-[#18211f]">{notification.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-[#66736f]">{notification.message}</p>
                      </div>
                      <span className="rounded-md border border-[#cfe4df] bg-[#eff8f5] px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#1f6f68]">
                        {notification.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-[#49534f]">
                      <span className="rounded bg-[#edf0eb] px-2 py-1">v{notification.version}</span>
                      <span className="rounded bg-[#edf0eb] px-2 py-1">{notification.audience}</span>
                      <span className="rounded bg-[#edf0eb] px-2 py-1">{notification.platform}</span>
                      {notification.forceUpdate && (
                        <span className="rounded bg-[#fff0ed] px-2 py-1 text-[#b42318]">Required</span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#89918d]">
                      <span>{formatDate(notification.createdAt)}</span>
                      <div className="flex gap-3">
                        {notification.playStoreUrl && (
                          <a
                            href={notification.playStoreUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-bold text-[#1f6f68]"
                          >
                            Play Store <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {notification.appStoreUrl && (
                          <a
                            href={notification.appStoreUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-bold text-[#1f6f68]"
                          >
                            App Store <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
