'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { get, off, onValue, ref } from 'firebase/database';
import { auth, database } from '@/lib/firebase';
import { createAdminSession, saveAdminSession } from '@/lib/adminSession';
import { useRegisterScrollMotion } from '@/components/RegisterMotion';
import PasakayLoader from '@/components/PasakayLoader';
import {
  CheckCircle,
  Eye,
  EyeOff,
  Key,
  Lock,
  Mail,
  RefreshCw,
  Shield,
  ShieldCheck,
} from 'lucide-react';

type AdminUser = {
  userId: string;
  email: string;
  name?: string;
  userType?: string;
};

type LoginStage = 'LOGIN' | 'OTP';

const FALLBACK_LOGO = '/pasakay-logo.jpg';

const securityHighlights = [
  'Email and password gate',
  'Admin role verification',
  '6-digit email OTP',
  'Protected dashboard access',
];

const adminAreas = ['Drivers', 'Trips', 'Merchants', 'Payments'];

export default function LoginPage() {
  const router = useRouter();
  const pageRef = useRef<HTMLDivElement | null>(null);
  useRegisterScrollMotion(pageRef);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [stage, setStage] = useState<LoginStage>('LOGIN');
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const [pendingAdmin, setPendingAdmin] = useState<AdminUser | null>(null);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoVersion, setLogoVersion] = useState<string>('default');

  const resolvedLogoSrc = useMemo(() => {
    if (!logoUrl) return FALLBACK_LOGO;
    const separator = logoUrl.includes('?') ? '&' : '?';
    return `${logoUrl}${separator}v=${encodeURIComponent(logoVersion)}`;
  }, [logoUrl, logoVersion]);

  const maskedEmail = useMemo(() => {
    const targetEmail = pendingAdmin?.email || email;
    const [name, domain] = targetEmail.split('@');
    if (!name || !domain) return targetEmail || 'admin email';
    const visible = name.slice(0, Math.min(2, name.length));
    return `${visible}${'*'.repeat(Math.max(2, name.length - visible.length))}@${domain}`;
  }, [email, pendingAdmin]);

  const otpProgress = Math.min(100, (otp.length / 6) * 100);
  const isBusy = loading || otpLoading;

  useEffect(() => {
    const appRef = ref(database, 'settings/app');

    const unsubscribe = onValue(
      appRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setLogoUrl(null);
          setLogoVersion('default');
          localStorage.removeItem('cachedLogoUrl');
          localStorage.removeItem('cachedLogoUpdatedAt');
          return;
        }

        const data = snapshot.val() || {};
        const nextLogoUrl =
          typeof data.logoUrl === 'string' && data.logoUrl.trim() !== ''
            ? data.logoUrl.trim()
            : null;
        const nextVersion =
          typeof data.updatedAt === 'string' && data.updatedAt.trim() !== ''
            ? data.updatedAt
            : Date.now().toString();

        setLogoUrl(nextLogoUrl);
        setLogoVersion(nextVersion);

        if (nextLogoUrl) {
          localStorage.setItem('cachedLogoUrl', nextLogoUrl);
          localStorage.setItem('cachedLogoUpdatedAt', nextVersion);
        } else {
          localStorage.removeItem('cachedLogoUrl');
          localStorage.removeItem('cachedLogoUpdatedAt');
        }
      },
      (listenerError) => {
        console.error('Error loading logo:', listenerError);
        const cachedUrl = localStorage.getItem('cachedLogoUrl');
        const cachedUpdatedAt = localStorage.getItem('cachedLogoUpdatedAt');
        if (cachedUrl) {
          setLogoUrl(cachedUrl);
          setLogoVersion(cachedUpdatedAt || 'cached');
        }
      }
    );

    return () => {
      off(appRef);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (otpResendCooldown <= 0) return;
    const id = setInterval(() => setOtpResendCooldown((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(id);
  }, [otpResendCooldown]);

  const getIdToken = async () => {
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  };

  const sendOtp = async (adminPayload: AdminUser) => {
    try {
      setOtpLoading(true);
      setError('');
      const token = await getIdToken();
      if (!token) {
        setError('Unable to verify session. Please login again.');
        return false;
      }
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: adminPayload.email, userId: adminPayload.userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to send OTP');
        return false;
      }
      if (data.expiresAt) setOtpExpiresAt(data.expiresAt);
      setOtpResendCooldown(60);
      return true;
    } catch (e) {
      console.error('OTP send error', e);
      setError('Failed to send OTP. Please try again.');
      return false;
    } finally {
      setOtpLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const userId = user.uid;

      if (!user.emailVerified) {
        setError('Please verify your email address before logging in. Check your inbox for the verification email.');
        await auth.signOut();
        setLoading(false);
        return;
      }

      const userRef = ref(database, `users/${userId}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const userData = snapshot.val();

        if (userData.userType === 'admin') {
          const adminPayload: AdminUser = {
            userId,
            email: userData.email,
            name: userData.name,
            userType: userData.userType,
          };
          const otpOk = await sendOtp(adminPayload);
          if (otpOk) {
            setPendingAdmin(adminPayload);
            setStage('OTP');
          }
        } else {
          setError('Access denied. Admin privileges required.');
          await auth.signOut();
        }
      } else {
        setError('User not found in database.');
        await auth.signOut();
      }
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/user-not-found') {
        setError('No account found with this email.');
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password.');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingAdmin) {
      setError('Session expired. Please login again.');
      setStage('LOGIN');
      return;
    }
    setOtpLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      if (!token) {
        setError('Unable to verify session. Please login again.');
        return;
      }
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: pendingAdmin.email, userId: pendingAdmin.userId, code: otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid code');
        return;
      }
      saveAdminSession(createAdminSession(pendingAdmin));
      router.push('/dashboard');
    } catch (err) {
      console.error('Verify OTP error', err);
      setError('Failed to verify code. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setStage('LOGIN');
    setOtp('');
    setError('');
  };

  return (
    <div ref={pageRef} className="min-h-screen bg-[#f6f8f5] text-[#18211f]">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.36]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(31, 111, 104, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(31, 111, 104, 0.06) 1px, transparent 1px)',
          backgroundSize: '34px 34px',
        }}
      />

      <div className="relative min-h-screen">
        <div className="mx-auto grid min-h-screen w-full max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[0.96fr_1.04fr] lg:px-8">
          <section className="hidden min-h-[calc(100vh-3rem)] flex-col justify-between rounded-lg border border-[#163633] bg-[#10201e] p-8 text-white shadow-2xl shadow-[#10201e]/20 lg:flex">
            <div>
              <div className="gsap-hero flex items-center justify-between gap-5">
                <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#78d1c8]">
                  <ShieldCheck className="h-4 w-4" />
                  Pasakay control
                </div>
                <span className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100">
                  Admin only
                </span>
              </div>

              <div className="gsap-hero mt-12 max-w-xl">
                <h1 className="text-5xl font-bold leading-[1.05] tracking-tight">
                  Secure access for daily Pasakay operations.
                </h1>
                <p className="mt-5 text-base leading-7 text-white/64">
                  Sign in, pass OTP verification, then manage core admin activity from one protected dashboard.
                </p>
              </div>

              <div className="gsap-card mt-10 rounded-lg border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/42">
                      Access sequence
                    </p>
                    <p className="mt-2 text-lg font-bold">Two-step verification</p>
                  </div>
                  <Lock className="h-6 w-6 text-[#f4b84d]" />
                </div>

                <div className="mt-5 grid grid-cols-[2.5rem_1fr] gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-bold text-[#10201e]">
                    1
                  </span>
                  <div className="border-b border-white/10 pb-5">
                    <p className="text-sm font-bold">Verify admin credentials</p>
                    <p className="mt-1 text-xs leading-5 text-white/55">
                      Firebase confirms the account and admin role before OTP starts.
                    </p>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm font-bold text-white/70">
                    2
                  </span>
                  <div>
                    <p className="text-sm font-bold">Confirm the email code</p>
                    <p className="mt-1 text-xs leading-5 text-white/55">
                      A short-lived code protects dashboard entry after password sign-in.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="gsap-card mt-8">
              <div className="grid grid-cols-4 gap-2">
                {adminAreas.map((area) => (
                  <div key={area} className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/38">
                      Monitor
                    </p>
                    <p className="mt-1 text-sm font-bold text-white">{area}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <main className="flex min-h-[calc(100vh-3rem)] items-center justify-center">
            <section className="w-full max-w-md">
              <div className="gsap-card overflow-hidden rounded-lg border border-[#dfe5e1] bg-white shadow-xl shadow-[#18211f]/8">
                <div className="border-b border-[#e5e2d8] bg-[#fbfcf9] px-6 py-5 sm:px-7">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-[52px] w-[52px] items-center justify-center rounded-md border border-[#dfe5e1] bg-white p-2 shadow-sm">
                        <img
                          key={resolvedLogoSrc}
                          src={resolvedLogoSrc}
                          alt="Pasakay Logo"
                          className="h-full w-full rounded-sm object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = FALLBACK_LOGO;
                          }}
                        />
                      </div>
                      <div>
                        <p className="text-lg font-bold tracking-tight text-[#18211f]">Pasakay Admin</p>
                        <p className="mt-1 text-xs font-medium text-[#66736f]">
                          {stage === 'LOGIN' ? 'Credential check' : 'OTP verification'}
                        </p>
                      </div>
                    </div>
                    <div className="hidden rounded-md border border-[#cde5de] bg-[#eff8f5] px-3 py-2 text-[#1f6f68] sm:block">
                      <Shield className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <div
                      className={`rounded-md border px-3 py-3 ${
                        stage === 'LOGIN'
                          ? 'border-[#1f6f68] bg-[#e8f4f2] text-[#1f6f68]'
                          : 'border-[#dfe5e1] bg-white text-[#66736f]'
                      }`}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em]">Step 1</p>
                      <p className="mt-1 text-sm font-bold">Sign in</p>
                    </div>
                    <div
                      className={`rounded-md border px-3 py-3 ${
                        stage === 'OTP'
                          ? 'border-[#1f6f68] bg-[#e8f4f2] text-[#1f6f68]'
                          : 'border-[#dfe5e1] bg-white text-[#66736f]'
                      }`}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em]">Step 2</p>
                      <p className="mt-1 text-sm font-bold">Confirm OTP</p>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-6 sm:px-7 sm:py-7">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-[#18211f]">
                      {stage === 'LOGIN' ? 'Welcome back.' : 'Check your inbox.'}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[#66736f]">
                      {stage === 'LOGIN'
                        ? 'Use an authorized admin account to continue to the dashboard.'
                        : `Enter the 6-digit code sent to ${maskedEmail}.`}
                    </p>
                  </div>

                  {error && (
                    <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-4">
                      <p className="text-sm font-semibold text-red-800">{error}</p>
                    </div>
                  )}

                  {stage === 'LOGIN' ? (
                    <form onSubmit={handleLogin} className="mt-7 space-y-5">
                      <div>
                        <label htmlFor="email" className="block text-xs font-bold uppercase tracking-[0.14em] text-[#49534f]">
                          Email address
                        </label>
                        <div className="relative mt-2">
                          <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a938f]" />
                          <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full rounded-md border border-[#d9d4c6] bg-white px-11 py-3.5 text-sm text-[#18211f] outline-none transition placeholder:text-[#a5aaa7] focus:border-[#1f6f68] focus:ring-2 focus:ring-[#1f6f68]/12"
                            placeholder="admin@pasakay.com"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="password" className="block text-xs font-bold uppercase tracking-[0.14em] text-[#49534f]">
                          Password
                        </label>
                        <div className="relative mt-2">
                          <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a938f]" />
                          <input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full rounded-md border border-[#d9d4c6] bg-white px-11 py-3.5 pr-12 text-sm text-[#18211f] outline-none transition placeholder:text-[#a5aaa7] focus:border-[#1f6f68] focus:ring-2 focus:ring-[#1f6f68]/12"
                            placeholder="Enter your password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-[#66736f] transition hover:bg-[#f3f6f2] hover:text-[#18211f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f68]/20"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#1f6f68] py-4 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#174c49] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f68]/30 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 disabled:shadow-none"
                      >
                        {loading ? (
                          <>
                            <PasakayLoader size="button" label="Signing in" />
                            <span>Signing in...</span>
                          </>
                        ) : (
                          <>
                            <Shield className="h-4 w-4" />
                            <span>Continue securely</span>
                          </>
                        )}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOtp} className="mt-7 space-y-5">
                      <div>
                        <label htmlFor="otp" className="block text-xs font-bold uppercase tracking-[0.14em] text-[#49534f]">
                          6-digit code
                        </label>
                        <div className="relative mt-2">
                          <Key className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a938f]" />
                          <input
                            id="otp"
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            required
                            className="w-full rounded-md border border-[#d9d4c6] bg-white py-3.5 pl-11 pr-4 text-center text-2xl font-bold tracking-[0.42em] text-[#18211f] outline-none transition placeholder:text-[#a5aaa7] focus:border-[#1f6f68] focus:ring-2 focus:ring-[#1f6f68]/12"
                            placeholder="000000"
                          />
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#edf0eb]">
                          <div
                            className="h-full rounded-full bg-[#1f6f68] transition-all duration-300"
                            style={{ width: `${otpProgress}%` }}
                          />
                        </div>
                      </div>

                      <div className="rounded-md border border-[#dfe5e1] bg-[#fbfcf9] p-4 text-sm leading-6 text-[#66736f]">
                        {otpExpiresAt ? (
                          <p>
                            Code expires at{' '}
                            <span className="font-bold text-[#18211f]">
                              {new Date(otpExpiresAt).toLocaleTimeString()}
                            </span>
                            .
                          </p>
                        ) : (
                          <p>Use the code sent to your admin email address.</p>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={otpLoading || otp.length !== 6}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#1f6f68] py-4 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#174c49] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f68]/30 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 disabled:shadow-none"
                      >
                        {otpLoading ? (
                          <>
                            <PasakayLoader size="button" label="Verifying code" />
                            <span>Verifying...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-4 w-4" />
                            <span>Verify and open dashboard</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center justify-between gap-4 text-xs font-bold">
                        <button
                          type="button"
                          onClick={handleBackToLogin}
                          disabled={isBusy}
                          className="text-[#66736f] transition hover:text-[#18211f] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Back to login
                        </button>
                        <button
                          type="button"
                          disabled={otpResendCooldown > 0 || otpLoading || !pendingAdmin}
                          onClick={() => pendingAdmin && sendOtp(pendingAdmin)}
                          className="text-[#1f6f68] transition hover:text-[#174c49] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {otpResendCooldown > 0 ? `Resend in ${otpResendCooldown}s` : 'Resend code'}
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="mt-7 grid gap-2 border-t border-[#e5e2d8] pt-5 sm:grid-cols-2">
                    {securityHighlights.map((item) => (
                      <div key={item} className="flex items-center gap-2 text-xs font-semibold text-[#66736f]">
                        <CheckCircle className="h-4 w-4 text-[#1f6f68]" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <p className="mt-5 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[#89918d]">
                Secure admin access only
              </p>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
