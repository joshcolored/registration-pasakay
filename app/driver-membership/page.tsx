'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Apple,
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle,
  ExternalLink,
  Facebook,
  Loader2,
  LogOut,
  Mail,
  ShieldCheck,
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
import { get, onValue, ref } from 'firebase/database';
import { auth, database } from '@/lib/firebase';

type Plan = '1_month' | '3_months';

const planCopy: Record<Plan, { label: string; months: number; days: number; fallbackPrice: number }> = {
  '1_month': { label: '1 Month', months: 1, days: 30, fallbackPrice: 299 },
  '3_months': { label: '3 Months', months: 3, days: 90, fallbackPrice: 599 },
};

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

const getDriverMembershipExpiry = (driver: any) =>
  driver?.membership_expires_at ||
  driver?.membership_expiresAt ||
  driver?.subscriptionExpiry ||
  driver?.subscriptionEndDate ||
  null;

const isFutureDate = (value?: string | number | null) => {
  if (!value) return false;
  const parsed = typeof value === 'number' ? value : Date.parse(String(value));
  if (Number.isNaN(parsed)) return false;
  return parsed >= Date.now();
};

const getDriverMembershipStatus = (driver: any) => {
  const explicitStatus = String(driver?.membership_status || '').trim().toLowerCase();
  const expiry = getDriverMembershipExpiry(driver);
  const subscriptionStatus = String(driver?.subscriptionStatus || '').trim().toLowerCase();
  const hasActiveSubscription = driver?.hasActiveSubscription === true;

  if (explicitStatus === 'active') {
    return expiry && !isFutureDate(expiry) ? 'expired' : 'active';
  }

  if ((subscriptionStatus === 'active' || hasActiveSubscription || expiry) && isFutureDate(expiry)) {
    return 'active';
  }

  if (explicitStatus === 'pending') return 'pending';
  if (explicitStatus === 'expired') return 'expired';
  return 'inactive';
};

const getDriverMembershipPlan = (driver: any): Plan | null => {
  const rawPlan = String(
    driver?.membership_plan ||
      driver?.plan ||
      driver?.subscriptionPlan ||
      driver?.subscriptionType ||
      ''
  )
    .trim()
    .toLowerCase();

  if (rawPlan === '3_months' || rawPlan === 'threemonths' || rawPlan === 'three_months') return '3_months';
  if (rawPlan === '1_month' || rawPlan === 'onemonth' || rawPlan === 'one_month') return '1_month';
  return null;
};

const isDriverAccount = (driver: any, userRecord?: any) => {
  const driverRole = String(driver?.role || driver?.userType || '').trim().toLowerCase();
  const userRole = String(userRecord?.role || userRecord?.userType || '').trim().toLowerCase();
  return driverRole === 'driver' || userRole === 'driver';
};

const normalizePlan = (plan: Plan) => (plan === '1_month' ? 'oneMonth' : 'threeMonths');

const getSignInErrorMessage = (authError: any) => {
  switch (authError?.code) {
    case 'auth/user-not-found':
      return 'No account was found with this email address.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a moment and try again.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled before it finished.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method.';
    case 'auth/unauthorized-domain':
      return 'This website domain is not allowed for Firebase sign-in yet. Add registration-pasakay.vercel.app in Firebase Authentication > Settings > Authorized domains.';
    default:
      return authError?.message || 'Unable to sign in. Please try again.';
  }
};

export default function DriverMembershipPortalPage() {
  const [user, setUser] = useState<User | null>(null);
  const [driver, setDriver] = useState<any | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [plan, setPlan] = useState<Plan>('1_month');
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
  const membershipStatus = getDriverMembershipStatus(driver);
  const activeUntil = getDriverMembershipExpiry(driver);
  const activePlan = getDriverMembershipPlan(driver);
  const isActiveOneMonthMember = membershipStatus === 'active' && activePlan === '1_month';
  const isActiveThreeMonthMember = membershipStatus === 'active' && activePlan === '3_months';
  const isOneMonthUnavailable = isActiveOneMonthMember || isActiveThreeMonthMember;
  const displayedMembershipStatus =
    membershipStatus === 'active' && activePlan ? `Active - ${planCopy[activePlan].label}` : membershipStatus;

  const driverDisplayName = useMemo(() => {
    return driver?.name || user?.displayName || user?.email || 'Driver';
  }, [driver, user]);

  const loadAndValidateDriver = async (nextUser: User) => {
    const driverRef = ref(database, `drivers/${nextUser.uid}`);
    const userRef = ref(database, `users/${nextUser.uid}`);
    const [driverSnapshot, userSnapshot] = await Promise.all([get(driverRef), get(userRef)]);
    const driverData = driverSnapshot.exists() ? driverSnapshot.val() : null;
    const userData = userSnapshot.exists() ? userSnapshot.val() : null;

    if (!driverData || !isDriverAccount(driverData, userData)) {
      setDriver(null);
      setUser(null);
      await signOut(auth);
      throw new Error('Only driver accounts can access the membership portal.');
    }

    setDriver(driverData);
    return driverData;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setLoadingAuth(false);

      if (!nextUser) {
        setUser(null);
        setDriver(null);
        return;
      }

      try {
        setError('');
        await loadAndValidateDriver(nextUser);
        setUser(nextUser);
      } catch (authError: any) {
        setError(authError.message || 'Only driver accounts can access the membership portal.');
      }
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

  useEffect(() => {
    if (isOneMonthUnavailable && plan === '1_month') {
      setPlan('3_months');
    }
  }, [isOneMonthUnavailable, plan]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get('checkout');
    if (checkoutStatus === 'success') {
      setMessage('Payment completed. PayMongo is confirming it now; your membership will activate automatically.');
    } else if (checkoutStatus === 'cancelled') {
      setError('PayMongo payment was cancelled. You can start a new QR Ph payment anytime.');
    }
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

      const credential = await signInWithPopup(auth, provider);
      await loadAndValidateDriver(credential.user);
      setUser(credential.user);
    } catch (authError: any) {
      setError(authError?.code ? getSignInErrorMessage(authError) : authError?.message || 'Unable to sign in. Please try again.');
    }
  };

  const signInWithEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      await loadAndValidateDriver(credential.user);
      setUser(credential.user);
    } catch (authError: any) {
      setError(authError?.code ? getSignInErrorMessage(authError) : authError?.message || 'Unable to sign in. Please try again.');
    }
  };

  const handleSignOut = async () => {
    if (!confirm('Are you sure you want to logout?')) return;
    await signOut(auth);
  };

  const startPayMongoCheckout = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (!driver) {
      setError('No driver profile was found for this account.');
      return;
    }

    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const idToken = await user.getIdToken();
      const checkoutResponse = await fetch('/api/driver/membership/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          plan,
        }),
      });
      const checkoutData = await checkoutResponse.json();

      if (!checkoutResponse.ok) {
        throw new Error(checkoutData?.error || 'Unable to start PayMongo checkout.');
      }

      if (!checkoutData?.checkoutUrl) {
        throw new Error('PayMongo checkout URL was not returned.');
      }

      window.location.href = checkoutData.checkoutUrl;
    } catch (submitError: any) {
      setError(submitError.message || 'Unable to start PayMongo payment.');
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-[100dvh] grid-rows-[auto_1fr_auto] bg-[#f5f4ef] text-[#18211f]">
      <section className="border-b border-[#e5e2d8] bg-[#fbfcf9]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-md border border-[#dfe5e1] bg-white p-1.5">
              <img src="/pasakay-logo.jpg" alt="PaSakay" className="h-full w-full rounded-sm object-contain" />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-black">PaSakay</p>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#66736f] sm:tracking-[0.16em]">Driver Membership</p>
            </div>
          </div>
          {user && (
            <button
              onClick={handleSignOut}
              className="inline-flex shrink-0 items-center gap-2 rounded-md border border-[#dfe5e1] bg-white px-3 py-2 text-sm font-bold text-[#49534f] transition hover:bg-[#edf0eb]"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          )}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl self-center gap-8 px-4 py-10 sm:px-5 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
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
{/* 
          <div className="rounded-md border border-[#dfe5e1] bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2">
              <img src="/gcash-logo.png" alt="GCash" className="h-7 w-28 object-contain" />
              <div className="text-base font-semibold leading-6 text-[#18211f]">
                <p>AR••E FR••Z L.</p>
                <p>09945172742</p>
              </div>
            </div>
          </div> */}

          {user && (
            <div className="rounded-md border border-[#dfe5e1] bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#66736f]">Current status</p>
              <div className="mt-3 flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="max-w-full break-words text-2xl font-black capitalize text-[#18211f]">{displayedMembershipStatus}</p>
                  <p className="mt-1 text-sm text-[#66736f]">
                    {membershipStatus === 'active'
                      ? `Active until ${formatDate(activeUntil)}`
                      : 'Membership requests are reviewed by PaSakay Admin.'}
                  </p>
                </div>
                <span className="max-w-full break-all rounded-md bg-[#e8f4f2] px-3 py-1 text-xs font-black uppercase tracking-[0.1em] text-[#1f6f68] sm:max-w-[55%] sm:tracking-[0.12em]">
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

              {error && (
                <div className="flex items-start gap-3 rounded-md border border-[#f0c2bd] bg-[#fff3f1] p-4 text-sm font-semibold text-[#b42318]">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              )}

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
            <form onSubmit={startPayMongoCheckout} className="space-y-5">
              <div>
                <h2 className="text-2xl font-black">Membership request</h2>
                <p className="mt-1 text-sm text-[#66736f]">Pay with PayMongo QR Ph. Membership activates automatically after successful payment.</p>
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
                    disabled={isOneMonthUnavailable && value === '1_month'}
                    onClick={() => {
                      if (!(isOneMonthUnavailable && value === '1_month')) setPlan(value);
                    }}
                    className={`rounded-md border p-4 text-left transition ${
                      isOneMonthUnavailable && value === '1_month'
                        ? 'cursor-not-allowed border-[#dfe5e1] bg-[#f6f8f5] opacity-55'
                        : plan === value
                          ? 'border-[#1f6f68] bg-[#e8f4f2]'
                          : 'border-[#dfe5e1] bg-white hover:bg-[#f6f8f5]'
                    }`}
                  >
                    <p className="font-black">{planCopy[value].label}</p>
                    <p className="mt-1 text-sm text-[#66736f]">{planCopy[value].days} days</p>
                    {isOneMonthUnavailable && value === '1_month' && (
                      <p className="mt-2 text-xs font-bold text-[#66736f]">
                        {isActiveOneMonthMember ? 'Upgrade available with 3 Months' : 'Unavailable while 3 Months is active'}
                      </p>
                    )}
                    <p className="mt-3 text-2xl font-black text-[#1f6f68]">₱{prices[value].toLocaleString()}</p>
                  </button>
                ))}
              </div>

              <div className="rounded-md border border-[#cce5df] bg-[#f1faf7] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-[#18211f]">PayMongo QR PH payment</p>
                    <p className="mt-1 text-sm text-[#66736f]">
                      Pay PHP {amount.toLocaleString()} for {selectedPlan.label}. PayMongo will confirm the payment and activate your membership automatically.
                    </p>
                  </div>
                  {/* <span className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-black text-[#1f6f68]">
                    QR Ph only
                  </span> */}
                </div>
              </div>

              {error && <div className="rounded-md bg-[#fff3f1] p-3 text-sm font-semibold text-[#b42318]">{error}</div>}
              {message && <div className="rounded-md bg-[#eff8f5] p-3 text-sm font-semibold text-[#1f6f68]">{message}</div>}

              <button
                disabled={submitting || !driver || isActiveThreeMonthMember}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-[#1f6f68] px-4 py-3 font-black text-white disabled:opacity-55"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Building2 className="h-5 w-5" />}
                {isActiveThreeMonthMember ? '3 Months Membership Active' : (
                  <>
                    Pay with PayMongo QR PH
                    <ExternalLink className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </section>

      <footer className="border-t border-[#dfe5e1] bg-[#10201e] text-white">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-start">
              <div className="max-w-md">
                <a
                  href="/"
                  className="inline-flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#83ddd3]"
                >
                  <img
                    src="/pasakay-logo.jpg"
                    alt="Pasakay logo"
                    className="h-11 w-11 rounded-md border border-white/15 bg-white object-cover"
                  />
                  <span>
                    <span className="block text-lg font-bold leading-none">Pasakay</span>
                    <span className="mt-1.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                      Driver membership
                    </span>
                  </span>
                </a>
                <p className="mt-4 text-sm leading-6 text-white/65">
                  Secure membership activation, renewal, and upgrades for verified Pasakay drivers.
                </p>
              </div>

              <nav aria-label="Footer navigation" className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
                <a href="/" className="font-semibold text-white/70 transition hover:text-white">
                  Home
                </a>
                <a href="/register/driver" className="font-semibold text-white/70 transition hover:text-white">
                  Driver
                </a>
                <a href="/register/merchant" className="font-semibold text-white/70 transition hover:text-white">
                  Merchant
                </a>
                <a href="/driver-membership" className="font-semibold text-white/70 transition hover:text-white">
                  Membership
                </a>
                <a href="/privacy" className="font-semibold text-white/70 transition hover:text-white">
                  Privacy
                </a>
              </nav>
            </div>

            <div className="mt-8 flex flex-col gap-2 border-t border-white/10 pt-5 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
              <p>&copy; {new Date().getFullYear()} Pasakay. All rights reserved.</p>
              <p>Membership payments secured through PayMongo QR PH.</p>
            </div>
          </div>
        </footer>
    </main>
  );
}
