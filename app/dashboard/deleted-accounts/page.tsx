'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { equalTo, get, orderByChild, query, ref, remove } from 'firebase/database';
import { database } from '@/lib/firebase';
import DashboardLayout from '@/components/DashboardLayout';
import PasakayLoader from '@/components/PasakayLoader';
import { getStoredAdminSession } from '@/lib/adminSession';
import { AlertTriangle, CalendarClock, Mail, RotateCcw, Search, ShieldCheck, Trash2 } from 'lucide-react';

interface DeletedAccountMarker {
  id: string;
  provider?: string;
  email_hash?: string;
  provider_user_id_hash?: string;
  deleted_at?: string;
  reactivation_allowed_at?: string;
  reason?: string;
  created_at?: string;
  updated_at?: string;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const sha256Hex = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const formatDateTime = (value?: string) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const isBlockActive = (marker: DeletedAccountMarker) => {
  if (!marker.reactivation_allowed_at) return true;
  const allowedAt = new Date(marker.reactivation_allowed_at);
  if (Number.isNaN(allowedAt.getTime())) return true;
  return Date.now() < allowedAt.getTime();
};

export default function DeletedAccountsPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [markers, setMarkers] = useState<DeletedAccountMarker[]>([]);
  const [searchedEmail, setSearchedEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const adminUser = getStoredAdminSession();
    if (!adminUser) {
      router.push('/pasakay/login');
    }
  }, [router]);

  const activeCount = useMemo(
    () => markers.filter((marker) => isBlockActive(marker)).length,
    [markers]
  );

  const searchDeletedMarkers = async () => {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      setError('Enter the deleted account email first.');
      return;
    }

    setLoading(true);
    setError('');
    setMarkers([]);
    setSearchedEmail(normalized);

    try {
      const emailHash = await sha256Hex(normalized);
      const markersQuery = query(
        ref(database, 'deleted_accounts'),
        orderByChild('email_hash'),
        equalTo(emailHash)
      );
      const snapshot = await get(markersQuery);

      if (!snapshot.exists()) {
        setMarkers([]);
        return;
      }

      const data = snapshot.val() as Record<string, Omit<DeletedAccountMarker, 'id'>>;
      const found = Object.entries(data).map(([id, value]) => ({
        id,
        ...value,
      }));
      found.sort((a, b) => {
        const aTime = new Date(a.deleted_at || a.created_at || 0).getTime();
        const bTime = new Date(b.deleted_at || b.created_at || 0).getTime();
        return bTime - aTime;
      });
      setMarkers(found);
    } catch (searchError) {
      console.error('Error searching deleted accounts:', searchError);
      setError('Failed to search deleted account markers.');
    } finally {
      setLoading(false);
    }
  };

  const clearDeletionBlock = async (marker: DeletedAccountMarker) => {
    const confirmed = window.confirm(
      `Allow this ${marker.provider || 'account'} login/register again?\n\nThis removes only the 30-day deleted-account block. It does not restore the old merchant profile, menu, orders, or Firebase Auth account.`
    );
    if (!confirmed) return;

    setRemovingId(marker.id);
    try {
      await remove(ref(database, `deleted_accounts/${marker.id}`));
      setMarkers((current) => current.filter((item) => item.id !== marker.id));
      alert('Deleted-account block removed. The user can register again with this email/provider.');
    } catch (removeError) {
      console.error('Error removing deleted account marker:', removeError);
      alert('Failed to remove the deleted-account block.');
    } finally {
      setRemovingId(null);
    }
  };

  const clearAllDeletionBlocks = async () => {
    if (markers.length === 0) return;
    const confirmed = window.confirm(
      `Remove all ${markers.length} deleted-account block(s) for ${searchedEmail}?\n\nThis allows the user to register again, but old deleted data is not restored.`
    );
    if (!confirmed) return;

    setRemovingId('all');
    try {
      await Promise.all(
        markers.map((marker) => remove(ref(database, `deleted_accounts/${marker.id}`)))
      );
      setMarkers([]);
      alert('All deleted-account blocks were removed for this email.');
    } catch (removeError) {
      console.error('Error removing deleted account markers:', removeError);
      alert('Failed to remove all deleted-account blocks.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Deleted Accounts</h1>
            <p className="text-gray-600">
              Remove a 30-day deletion block so a user can register again after an accidental deletion.
            </p>
          </div>
          {markers.length > 1 && (
            <button
              onClick={clearAllDeletionBlocks}
              disabled={removingId !== null}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:bg-red-300"
            >
              <Trash2 className="h-4 w-4" />
              Remove All Blocks
            </button>
          )}
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-semibold">This is not a full restore.</p>
              <p>
                The mobile app deletes account data and Firebase Auth, then stores hashed deletion markers.
                Removing a marker only lets the person create a fresh account with the same email/provider.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="mb-2 block text-sm font-semibold text-gray-700">
            Search by deleted account email
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') searchDeletedMarkers();
                }}
                placeholder="merchant@email.com"
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={searchDeletedMarkers}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black disabled:bg-gray-500"
            >
              {loading ? (
                <>
                  <PasakayLoader size="button" label="Searching deleted accounts" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Search
                </>
              )}
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        {searchedEmail && !loading && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col gap-1 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Search Result</h2>
                <p className="text-sm text-gray-600">{searchedEmail}</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-700">
                <ShieldCheck className="h-4 w-4" />
                {activeCount} active block{activeCount === 1 ? '' : 's'}
              </div>
            </div>

            {markers.length === 0 ? (
              <div className="p-8 text-center">
                <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
                <h3 className="text-base font-semibold text-gray-900">No deletion block found</h3>
                <p className="mt-1 text-sm text-gray-600">
                  This email is not currently blocked by the app&apos;s deleted account protection.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {markers.map((marker) => {
                  const active = isBlockActive(marker);
                  return (
                    <div key={marker.id} className="p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase text-gray-700">
                              {marker.provider || 'unknown'}
                            </span>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                active
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {active ? 'Blocked' : 'Expired'}
                            </span>
                          </div>
                          <div className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
                            <div className="flex items-center gap-2">
                              <CalendarClock className="h-4 w-4 text-gray-400" />
                              Deleted: {formatDateTime(marker.deleted_at)}
                            </div>
                            <div className="flex items-center gap-2">
                              <RotateCcw className="h-4 w-4 text-gray-400" />
                              Allowed again: {formatDateTime(marker.reactivation_allowed_at)}
                            </div>
                          </div>
                          <p className="max-w-3xl break-all text-xs text-gray-500">
                            Marker: {marker.id}
                          </p>
                          {marker.reason && (
                            <p className="text-xs text-gray-500">Reason: {marker.reason}</p>
                          )}
                        </div>

                        <button
                          onClick={() => clearDeletionBlock(marker)}
                          disabled={removingId !== null}
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:bg-emerald-300"
                        >
                          {removingId === marker.id ? (
                            <>
                              <PasakayLoader size="button" label="Removing deletion block" />
                              Removing...
                            </>
                          ) : (
                            <>
                              <RotateCcw className="h-4 w-4" />
                              Allow Register Again
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
