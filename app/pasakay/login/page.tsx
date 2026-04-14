'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { get, off, onValue, ref } from 'firebase/database';
import { auth, database } from '@/lib/firebase';
import {
  Eye,
  EyeOff,
  Mail,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

type AdminUser = {
  userId: string;
  email: string;
  name?: string;
  userType?: string;
};

const FALLBACK_LOGO = '/pasakay-logo.jpg';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [stage, setStage] = useState<'LOGIN' | 'OTP'>('LOGIN');
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
      localStorage.setItem('adminUser', JSON.stringify(pendingAdmin));
      router.push('/dashboard');
    } catch (err) {
      console.error('Verify OTP error', err);
      setError('Failed to verify code. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div
        className="min-h-screen"
        style={{
          backgroundColor: '#050505',
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
          backgroundPosition: '0 0',
        }}
      >
        <div className="mx-auto flex min-h-screen max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <section className="hidden lg:block">
              <div className="max-w-xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-zinc-300">
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                  Pasakay Control
                </div>
                <h1 className="mt-6 text-5xl font-semibold leading-tight tracking-tight text-white">
                  Secure admin access for Pasakay operations.
                </h1>
                <p className="mt-6 text-lg leading-8 text-zinc-400">
                  Monitor drivers, payments, trips, merchants, and settings from a
                  cleaner control panel with OTP verification.
                </p>

                <div className="mt-10 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <ShieldCheck className="h-6 w-6 text-emerald-400" />
                    <h2 className="mt-4 text-lg font-semibold text-white">Protected Login</h2>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      Email-password sign-in backed by OTP verification before dashboard access.
                    </p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <Mail className="h-6 w-6 text-sky-400" />
                    <h2 className="mt-4 text-lg font-semibold text-white">Live Branding</h2>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      Logo changes now refresh correctly instead of staying stuck on an older cached image.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="w-full">
              <div className="mx-auto w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8">
                <div className="text-center">
                  <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-[2rem] border border-white/10 bg-white/95 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
                    <img
                      key={resolvedLogoSrc}
                      src={resolvedLogoSrc}
                      alt="Pasakay Logo"
                      className="h-full w-full rounded-2xl object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = FALLBACK_LOGO;
                      }}
                    />
                  </div>
                  <h2 className="mt-6 text-3xl font-semibold tracking-tight text-white">
                    Pasakay Admin
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    {stage === 'LOGIN'
                      ? 'Sign in to access dashboard tools and protected admin actions.'
                      : 'Enter the 6-digit code sent to your email to continue.'}
                  </p>
                </div>

                {error && (
                  <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                    <p className="text-sm text-red-200">{error}</p>
                  </div>
                )}

                {stage === 'LOGIN' ? (
                  <form onSubmit={handleLogin} className="mt-8 space-y-5">
                    <div>
                      <label htmlFor="email" className="mb-2 block text-sm font-medium text-zinc-200">
                        Email Address
                      </label>
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3.5 text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20 focus:bg-black/50"
                        placeholder="admin@pasakay.com"
                      />
                    </div>

                    <div>
                      <label htmlFor="password" className="mb-2 block text-sm font-medium text-zinc-200">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3.5 pr-12 text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20 focus:bg-black/50"
                          placeholder="Enter your password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-white"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        <>
                          <Shield className="h-4 w-4" />
                          Sign In
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="mt-8 space-y-5">
                    <div>
                      <label htmlFor="otp" className="mb-2 block text-sm font-medium text-zinc-200">
                        Enter the 6-digit code
                      </label>
                      <input
                        id="otp"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        required
                        className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3.5 text-center text-2xl tracking-[0.5em] text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20 focus:bg-black/50"
                        placeholder="000000"
                      />
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-zinc-400">
                      {otpExpiresAt ? (
                        <p>Code expires at {new Date(otpExpiresAt).toLocaleTimeString()}.</p>
                      ) : (
                        <p>Use the code sent to your admin email address.</p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={otpLoading || otp.length !== 6}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {otpLoading ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-4 w-4" />
                          Verify OTP
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-between text-sm text-zinc-400">
                      <button
                        type="button"
                        onClick={() => {
                          setStage('LOGIN');
                          setOtp('');
                          setError('');
                        }}
                        className="transition hover:text-white"
                      >
                        Back to login
                      </button>
                      <button
                        type="button"
                        disabled={otpResendCooldown > 0 || otpLoading || !pendingAdmin}
                        onClick={() => pendingAdmin && sendOtp(pendingAdmin)}
                        className="transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {otpResendCooldown > 0 ? `Resend in ${otpResendCooldown}s` : 'Resend code'}
                      </button>
                    </div>
                  </form>
                )}

                <p className="mt-8 text-center text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Secure admin access only
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
