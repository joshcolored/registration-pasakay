'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { ref, get, onValue, off } from 'firebase/database';
import { auth, database } from '@/lib/firebase';
import { Eye, EyeOff, Shield, RefreshCw, Mail } from 'lucide-react';

type AdminUser = {
  userId: string;
  email: string;
  name?: string;
  userType?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [stage, setStage] = useState<"LOGIN" | "OTP">("LOGIN");
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const [pendingAdmin, setPendingAdmin] = useState<AdminUser | null>(null);
  
  // Initialize logo from localStorage cache for instant display
  const [logoUrl, setLogoUrl] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cachedLogoUrl');
    }
    return null;
  });

  useEffect(() => {
    // Set up real-time listener for logo
    const appRef = ref(database, 'settings/app');
    
    const unsubscribe = onValue(appRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Check for valid logo URL (not empty string, not null, not undefined)
        const newLogoUrl = data.logoUrl && data.logoUrl.trim() !== '' ? data.logoUrl : null;
        
        setLogoUrl(newLogoUrl);
        
        if (newLogoUrl) {
          // Cache for instant display on refresh
          localStorage.setItem('cachedLogoUrl', newLogoUrl);
        } else {
          localStorage.removeItem('cachedLogoUrl');
        }
      } else {
        setLogoUrl(null);
        localStorage.removeItem('cachedLogoUrl');
      }
    }, (error) => {
      console.error('Error loading logo:', error);
    });

    // Cleanup listener on unmount
    return () => {
      off(appRef);
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
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const userId = user.uid;

      // Check if email is verified (skip for admins created manually)
      if (!user.emailVerified) {
        setError('Please verify your email address before logging in. Check your inbox for the verification email.');
        await auth.signOut();
        setLoading(false);
        return;
      }

      // Check if user is admin
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
            setStage("OTP");
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
      setStage("LOGIN");
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-32 h-32 bg-white rounded-3xl shadow-lg flex items-center justify-center p-2">
              <img
                key={logoUrl || 'default-logo'}
                src={logoUrl || "/pasakay-logo.png"}
                alt="Pasakay Logo"
                className="w-full h-full object-contain rounded-2xl"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/pasakay-logo.png';
                }}
              />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Pasakay Admin</h1>
          <p className="text-gray-600">
            {stage === "LOGIN" ? "Sign in to access the dashboard" : "Enter the code we emailed to you"}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {stage === "LOGIN" ? (
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-black mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-black font-semibold placeholder-gray-400"
                placeholder="admin@pasakay.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-bold text-black mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-black font-semibold placeholder-gray-400"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div>
              <label htmlFor="otp" className="block text-sm font-bold text-black mb-2">
                Enter the 6-digit code
              </label>
              <div className="relative">
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-black font-semibold placeholder-gray-400 tracking-widest text-center"
                  placeholder="123456"
                />
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
              {otpExpiresAt && (
                <p className="text-xs text-gray-500 mt-2">
                  Expires at {new Date(otpExpiresAt).toLocaleTimeString()}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStage("LOGIN");
                  setOtp('');
                  setPendingAdmin(null);
                  setOtpExpiresAt(null);
                }}
                className="text-blue-600 hover:underline"
              >
                Back to login
              </button>
              <button
                type="button"
                disabled={otpResendCooldown > 0 || otpLoading || !pendingAdmin}
                onClick={() => {
                  if (pendingAdmin) sendOtp(pendingAdmin);
                }}
                className="flex items-center gap-2 text-blue-600 hover:underline disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                {otpResendCooldown > 0 ? `Resend (${otpResendCooldown}s)` : 'Resend code'}
              </button>
            </div>

            <button
              type="submit"
              disabled={otpLoading || otp.length !== 6}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {otpLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Verifying...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  Verify & Continue
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Ac 2025 Pasakay. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
