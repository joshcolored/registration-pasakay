'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Apple,
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle,
  CreditCard,
  Facebook,
  Landmark,
  Loader2,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { get, onValue, push, ref, update } from 'firebase/database';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { auth, database, storage } from '@/lib/firebase';
import { createAdminNotification } from '@/lib/adminNotifications';

type Plan = '1_month' | '3_months';
type PaymentMethod = 'gcash' | 'maya' | 'card' | 'bank_transfer';

const planCopy: Record<Plan, { label: string; months: number; days: number; fallbackPrice: number }> = {
  '1_month': { label: '1 Month', months: 1, days: 30, fallbackPrice: 150 },
  '3_months': { label: '3 Months', months: 3, days: 90, fallbackPrice: 300 },
};

const paymentMethods: Array<{ value: PaymentMethod; label: string; icon: any }> = [
  { value: 'gcash', label: 'GCash', icon: Wallet },
  { value: 'maya', label: 'Maya', icon: Phone },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: Landmark },
];

const formatDate = (value?: string | number | null) => {
  if (!value) return 'Not active';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const normalizePlan = (plan: Plan) => (plan === '1_month' ? 'oneMonth' : 'threeMonths');

export default function DriverMembershipPortalPage() {
  const [user, setUser] = useState<User | null>(null);
  const [driver, setDriver] = useState<any | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [plan, setPlan] = useState<Plan>('1_month');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('gcash');
  const [paymentReference, setPaymentReference] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [prices, setPrices] = useState<Record<Plan, number>>({
    '1_month': planCopy['1_month'].fallbackPrice,
    '3_months': planCopy['3_months'].fallbackPrice,
  });

  const selectedPlan = planCopy[plan];
  const amount = prices[plan] || selectedPlan.fallbackPrice;
  const membershipStatus = String(driver?.membership_status || 'inactive').toLowerCase();
  const activeUntil = driver?.membership_expires_at || driver?.subscriptionExpiry || null;

  const driverDisplayName = useMemo(() => {
    return driver?.name || user?.displayName || user?.email || 'Driver';
  }, [driver, user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setLoadingAuth(false);

      if (!nextUser) {
        setDriver(null);
        return;
      }

      const driverRef = ref(database, `drivers/${nextUser.uid}`);
      const driverSnapshot = await get(driverRef);
      setDriver(driverSnapshot.exists() ? driverSnapshot.val() : null);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const driverRef = ref(database, `drivers/${user.uid}`);
    const unsubscribe = onValue(driverRef, (snapshot) => {
      setDriver(snapshot.exists() ? snapshot.val() : null);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const settingsRef = ref(database, 'settings/subscription');
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.val();
      setPrices({
        '1_month': Number(data.oneMonthPrice || planCopy['1_month'].fallbackPrice),
        '3_months': Number(data.threeMonthsPrice || planCopy['3_months'].fallbackPrice),
      });
    });
    return () => unsubscribe();
  }, []);

  const signInWithProvider = async (providerName: 'apple' | 'google' | 'facebook') => {
    setError('');
    setMessage('');
    try {
      const provider =
        providerName === 'apple'
          ? new OAuthProvider('apple.com')
          : providerName === 'google'
            ? new GoogleAuthProvider()
            : new FacebookAuthProvider();

      if (providerName === 'apple') {
        (provider as OAuthProvider).addScope('email');
        (provider as OAuthProvider).addScope('name');
      }

      await signInWithPopup(auth, provider);
    } catch (authError: any) {
      setError(authError.message || 'Unable to sign in. Please try again.');
    }
  };

  const signInWithEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (authError: any) {
      setError(authError.message || 'Unable to sign in. Please try again.');
    }
  };

  const submitPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (!driver) {
      setError('No driver profile was found for this account.');
      return;
    }
    if (!paymentReference.trim()) {
      setError('Enter a payment reference number.');
      return;
    }

    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      let proofUrl = '';
      if (proofFile) {
        const path = `driver-memberships/${user.uid}/${Date.now()}-${proofFile.name}`;
        const fileRef = storageRef(storage, path);
        await uploadBytes(fileRef, proofFile);
        proofUrl = await getDownloadURL(fileRef);
      }

      const requestRef = push(ref(database, 'driver_membership_payments'));
      const requestId = requestRef.key;
      if (!requestId) throw new Error('Unable to create membership request.');

      const now = new Date().toISOString();
      const payload = {
        requestId,
        driverId: user.uid,
        driverName: driverDisplayName,
        driverEmail: user.email || driver.email || '',
        driverPhone: driver.phone || driver.phoneNumber || '',
        plan,
        planLabel: selectedPlan.label,
        amount,
        paymentMethod,
        paymentReference: paymentReference.trim(),
        proofUrl,
        status: 'pending',
        source: 'driver_membership_portal',
        createdAt: now,
        updatedAt: now,
      };

      const updates: Record<string, any> = {
        [`driver_membership_payments/${requestId}`]: payload,
        [`driver_membership_payment_history/${user.uid}/${requestId}`]: payload,
      };

      if (membershipStatus !== 'active') {
        updates[`drivers/${user.uid}/membership_status`] = 'pending';
        updates[`drivers/${user.uid}/membership_pending_request_id`] = requestId;
        updates[`drivers/${user.uid}/membership_pending_at`] = now;
      }

      await update(ref(database), updates);

      await createAdminNotification({
        title: 'Driver Membership Submitted',
        message: `${driverDisplayName} submitted a ${selectedPlan.label} membership request.`,
        type: 'paymentSubmitted',
        relatedId: requestId,
      });

      setPaymentReference('');
      setProofFile(null);
      setMessage('Membership request submitted. PaSakay Admin will review it shortly.');
    } catch (submitError: any) {
      setError(submitError.message || 'Unable to submit membership request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f4ef] text-[#18211f]">
      <section className="border-b border-[#e5e2d8] bg-[#fbfcf9]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-md border border-[#dfe5e1] bg-white p-1.5">
              <img src="/pasakay-logo.jpg" alt="PaSakay" className="h-full w-full rounded-sm object-contain" />
            </span>
            <div>
              <p className="text-lg font-black">PaSakay</p>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#66736f]">Driver Membership</p>
            </div>
          </div>
          {user && (
            <button
              onClick={() => signOut(auth)}
              className="inline-flex items-center gap-2 rounded-md border border-[#dfe5e1] bg-white px-3 py-2 text-sm font-bold text-[#49534f] transition hover:bg-[#edf0eb]"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#1f6f68]">Driver portal</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-[#18211f] md:text-5xl">
              Manage your PaSakay driver membership.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-[#66736f]">
              Sign in with your driver account, submit your membership payment details, and wait for PaSakay Admin approval.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Admin reviewed', ShieldCheck],
              ['Secure account login', BadgeCheck],
              ['Status syncs to app', CheckCircle],
            ].map(([label, Icon]) => (
              <div key={label as string} className="rounded-md border border-[#dfe5e1] bg-white p-4 shadow-sm">
                <Icon className="h-5 w-5 text-[#1f6f68]" />
                <p className="mt-3 text-sm font-bold text-[#18211f]">{label as string}</p>
              </div>
            ))}
          </div>

          {user && (
            <div className="rounded-md border border-[#dfe5e1] bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#66736f]">Current status</p>
              <div className="mt-3 flex items-start justify-between gap-4">
                <div>
                  <p className="text-2xl font-black capitalize text-[#18211f]">{membershipStatus}</p>
                  <p className="mt-1 text-sm text-[#66736f]">
                    {membershipStatus === 'active'
                      ? `Active until ${formatDate(activeUntil)}`
                      : 'Membership requests are reviewed by PaSakay Admin.'}
                  </p>
                </div>
                <span className="rounded-md bg-[#e8f4f2] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#1f6f68]">
                  {driverDisplayName}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-md border border-[#dfe5e1] bg-white p-5 shadow-[0_24px_70px_rgba(24,33,31,0.10)]">
          {loadingAuth ? (
            <div className="flex min-h-96 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-[#1f6f68]" />
            </div>
          ) : !user ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-black">Sign in</h2>
                <p className="mt-1 text-sm text-[#66736f]">Use the same account connected to your driver profile.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <button onClick={() => signInWithProvider('apple')} className="flex items-center justify-center gap-2 rounded-md border border-[#dfe5e1] px-3 py-3 font-bold hover:bg-[#f6f8f5]">
                  <Apple className="h-5 w-5" /> Apple ID
                </button>
                <button onClick={() => signInWithProvider('google')} className="flex items-center justify-center gap-2 rounded-md border border-[#dfe5e1] px-3 py-3 font-bold hover:bg-[#f6f8f5]">
                  <Mail className="h-5 w-5" /> Google
                </button>
                <button onClick={() => signInWithProvider('facebook')} className="flex items-center justify-center gap-2 rounded-md border border-[#dfe5e1] px-3 py-3 font-bold hover:bg-[#f6f8f5]">
                  <Facebook className="h-5 w-5" /> Facebook
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-[#e5e2d8]" />
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#66736f]">or email</span>
                <div className="h-px flex-1 bg-[#e5e2d8]" />
              </div>

              <form onSubmit={signInWithEmail} className="space-y-3">
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  placeholder="Email address"
                  className="w-full rounded-md border border-[#dfe5e1] px-4 py-3 outline-none"
                  required
                />
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  placeholder="Password"
                  className="w-full rounded-md border border-[#dfe5e1] px-4 py-3 outline-none"
                  required
                />
                <button className="flex w-full items-center justify-center gap-2 rounded-md bg-[#1f6f68] px-4 py-3 font-black text-white">
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>
          ) : (
            <form onSubmit={submitPayment} className="space-y-5">
              <div>
                <h2 className="text-2xl font-black">Membership request</h2>
                <p className="mt-1 text-sm text-[#66736f]">Submit your payment details for PaSakay Admin review.</p>
              </div>

              {!driver && (
                <div className="rounded-md border border-[#f0c2bd] bg-[#fff3f1] p-4 text-sm font-semibold text-[#b42318]">
                  No driver profile was found for this account.
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {(Object.keys(planCopy) as Plan[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPlan(value)}
                    className={`rounded-md border p-4 text-left transition ${
                      plan === value ? 'border-[#1f6f68] bg-[#e8f4f2]' : 'border-[#dfe5e1] bg-white hover:bg-[#f6f8f5]'
                    }`}
                  >
                    <p className="font-black">{planCopy[value].label}</p>
                    <p className="mt-1 text-sm text-[#66736f]">{planCopy[value].days} days</p>
                    <p className="mt-3 text-2xl font-black text-[#1f6f68]">₱{prices[value].toLocaleString()}</p>
                  </button>
                ))}
              </div>

              <div>
                <label className="text-sm font-black text-[#18211f]">Payment method</label>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {paymentMethods.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPaymentMethod(value)}
                      className={`flex items-center gap-3 rounded-md border px-3 py-3 text-sm font-bold transition ${
                        paymentMethod === value ? 'border-[#1f6f68] bg-[#e8f4f2] text-[#1f6f68]' : 'border-[#dfe5e1] hover:bg-[#f6f8f5]'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-black text-[#18211f]">Payment reference</label>
                <input
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  placeholder="Reference number or transaction ID"
                  className="mt-2 w-full rounded-md border border-[#dfe5e1] px-4 py-3 outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-black text-[#18211f]">Proof of payment</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(event) => setProofFile(event.target.files?.[0] || null)}
                  className="mt-2 w-full rounded-md border border-[#dfe5e1] bg-white px-4 py-3 text-sm"
                />
              </div>

              {error && <div className="rounded-md bg-[#fff3f1] p-3 text-sm font-semibold text-[#b42318]">{error}</div>}
              {message && <div className="rounded-md bg-[#eff8f5] p-3 text-sm font-semibold text-[#1f6f68]">{message}</div>}

              <button
                disabled={submitting || !driver}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-[#1f6f68] px-4 py-3 font-black text-white disabled:opacity-55"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Building2 className="h-5 w-5" />}
                Submit for Admin Review
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
