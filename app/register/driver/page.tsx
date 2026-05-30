'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, deleteUser, sendEmailVerification } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { getDatabase, ref, update } from 'firebase/database';
import { useRegisterScrollMotion } from '@/components/RegisterMotion';
import { createAdminNotification } from '@/lib/adminNotifications';

// Initialize Firebase (reuse from env config)
if (!getApps().length) {
  initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
}

const auth = getAuth();
const database = getDatabase();

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = 'dqjw2azfx';
const CLOUDINARY_UPLOAD_PRESET = 'ml_default';
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

const validateImageFile = (file: File | null, label: string) => {
  if (!file) return `${label} is required`;
  if (!file.type.startsWith('image/')) return `${label} must be an image file`;
  if (file.size > MAX_UPLOAD_SIZE_BYTES) return `${label} must be 10MB or smaller`;
  return '';
};

export default function DriverRegistrationPage() {
  const router = useRouter();
  const pageRef = useRef<HTMLDivElement | null>(null);
  useRegisterScrollMotion(pageRef);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    vehicleType: 'motorcycle',
    vehicleNumber: '',
    vehicleModel: '',
    vehicleLicense: '',
  });

  // File uploads
  const [driverLicenseFile, setDriverLicenseFile] = useState<File | null>(null);
  const [driverLicensePreview, setDriverLicensePreview] = useState<string | null>(null);
  const [orCrFile, setOrCrFile] = useState<File | null>(null);
  const [orCrPreview, setOrCrPreview] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'license' | 'orcr') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'license') {
          setDriverLicenseFile(file);
          setDriverLicensePreview(reader.result as string);
        } else {
          setOrCrFile(file);
          setOrCrPreview(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload file to Cloudinary
  const uploadToCloudinary = async (file: File, folder: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', folder);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error('Failed to upload image');
    }

    const data = await response.json();
    return data.secure_url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const name = formData.name.trim();
    const email = formData.email.trim().toLowerCase();
    const phone = formData.phone.trim();
    const vehicleNumber = formData.vehicleNumber.trim();
    const vehicleModel = formData.vehicleModel.trim();
    const vehicleLicense = formData.vehicleLicense.trim();

    // Validation
    if (!name || !email || !phone || !formData.password) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!phone.match(/^09\d{9}$/)) {
      setError('Phone number must be in format 09XX-XXX-XXXX');
      return;
    }

    if (!vehicleModel || !vehicleLicense || !vehicleNumber) {
      setError('Please complete your vehicle information');
      return;
    }

    const selectedDriverLicenseFile = driverLicenseFile;
    if (!selectedDriverLicenseFile) {
      setError('Driver\'s license image is required');
      return;
    }

    const licenseFileError = validateImageFile(selectedDriverLicenseFile, 'Driver\'s license image');
    if (licenseFileError) {
      setError(licenseFileError);
      return;
    }

    const selectedOrCrFile = orCrFile;
    if (!selectedOrCrFile) {
      setError('OR/CR document image is required');
      return;
    }

    const orCrFileError = validateImageFile(selectedOrCrFile, 'OR/CR document image');
    if (orCrFileError) {
      setError(orCrFileError);
      return;
    }

    if (!agreeToTerms) {
      setError('Please agree to the Terms of Service');
      return;
    }

    setIsLoading(true);
    let createdUser: FirebaseUser | null = null;
    let registrationSaved = false;

    try {
      // Step 1: Create user account
      console.log('Creating user account...');
      const userCredential = await createUserWithEmailAndPassword(auth, email, formData.password);
      const user = userCredential.user;
      createdUser = user;
      console.log('User created:', user.uid);

      // Step 2: Upload documents to Cloudinary
      console.log('Uploading driver license to Cloudinary...');
      const licenseUrl = await uploadToCloudinary(selectedDriverLicenseFile, `pasakay/drivers/${user.uid}`);
      console.log('License uploaded:', licenseUrl);

      console.log('Uploading OR/CR to Cloudinary...');
      const orCrUrl = await uploadToCloudinary(selectedOrCrFile, `pasakay/drivers/${user.uid}`);
      console.log('OR/CR uploaded:', orCrUrl);

      const now = new Date().toISOString();

      // Step 3: Create driver data
      const driverData = {
        uid: user.uid,
        email,
        name,
        phone,
        userType: 'driver',
        role: 'driver',
        vehicleType: formData.vehicleType,
        vehicleNumber,
        vehicleModel,
        vehicleLicense,
        driversLicenseUrl: licenseUrl,
        driverLicenseUrl: licenseUrl,
        orCrUrl: orCrUrl,
        isActive: true,
        isApproved: false,
        isOnline: false,
        status: 'pending',
        verificationStatus: 'pending',
        createdAt: now,
        updatedAt: now,
        rating: 0,
        ratingCount: 0,
        totalTrips: 0,
        completedTrips: 0,
        totalEarnings: 0,
        hasActiveSubscription: false,
        subscriptionStatus: 'none',
      };

      const userData = {
        uid: user.uid,
        email,
        name,
        phone,
        userType: 'driver',
        role: 'driver',
        isActive: true,
        isApproved: false,
        verificationStatus: 'pending',
        createdAt: now,
        updatedAt: now,
        rating: 0,
        totalTrips: 0,
      };

      // Step 4: Save to database
      console.log('Saving to database...');
      await update(ref(database), {
        [`users/${user.uid}`]: userData,
        [`drivers/${user.uid}`]: driverData,
      });
      registrationSaved = true;
      console.log('Database saved successfully');

      try {
        await createAdminNotification({
          title: 'New Driver Registration',
          message: `${name} has registered as a driver and needs verification.`,
          type: 'driverRegistration',
          relatedId: user.uid,
        });
      } catch (notificationError) {
        console.error('Admin notification error:', notificationError);
      }

      // Step 5: Send email verification
      try {
        await sendEmailVerification(user);
        console.log('Verification email sent');
      } catch (emailError) {
        console.error('Email verification error:', emailError);
        // Continue even if email fails
      }

      // Sign out the user (they shouldn't be logged in yet)
      try {
        await auth.signOut();
      } catch (signOutError) {
        console.error('Sign out error after registration:', signOutError);
      }

      setSuccess(true);
    } catch (err: any) {
      console.error('Registration error:', err);
      let cleanupWarning = '';
      if (createdUser && !registrationSaved) {
        try {
          await deleteUser(createdUser);
        } catch (cleanupError) {
          console.error('Failed to clean up incomplete driver account:', cleanupError);
          cleanupWarning = ' Your login account may have been created; contact admin if retry says the email is already registered.';
        }
        try {
          await auth.signOut();
        } catch (signOutError) {
          console.error('Sign out error after failed registration:', signOutError);
        }
      }

      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak');
      } else if (err.code === 'storage/unauthorized') {
        setError(`Storage permission denied. Please contact admin.${cleanupWarning}`);
      } else if (err.code === 'PERMISSION_DENIED') {
        setError(`Database permission denied. Please contact admin.${cleanupWarning}`);
      } else {
        setError(`${err.message || 'Registration failed. Please try again.'}${cleanupWarning}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f4ef] p-4">
        <div className="w-full max-w-md rounded-lg border border-[#d9d4c6] bg-white p-8 text-center shadow-[0_20px_50px_rgba(24,33,31,0.08)]">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle className="h-8 w-8 text-emerald-700" />
          </div>
          <h2 className="mb-2 text-2xl font-semibold text-[#18211f]">Registration Submitted</h2>
          <p className="mb-4 text-[#66736f]">
            Your driver account has been created successfully.
          </p>
          <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 p-4 text-left">
            <p className="mb-2 text-sm font-medium text-sky-900">What&apos;s next?</p>
            <ol className="space-y-2 text-sm text-sky-800">
              <li>1. Check your email ({formData.email}) and verify your account</li>
              <li>2. Admin will review your documents</li>
              <li>3. You&apos;ll be notified once approved</li>
              <li>4. Download the Pasakay app and start driving!</li>
            </ol>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800">
              Your account requires admin approval before you can start accepting rides.
            </p>
          </div>
          <button
            onClick={() => router.push('/register')}
            className="w-full rounded-md bg-[#1f6f68] py-3 font-semibold text-white transition-colors hover:bg-[#174c49]"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={pageRef}
      className="partner-form"
    >
      {/* Header */}
      <header className="partner-form-header sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.push('/register')}
            className="inline-flex items-center gap-2 rounded-xl border border-[#d9d4c6] bg-white px-4 py-2 text-xs font-bold text-[#18211f] shadow-sm transition-all duration-300 hover:border-[#1f6f68]/30 hover:bg-[#faf9f5]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Registration Landing</span>
          </button>
        </div>
      </header>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="gsap-hero mb-8 p-6 text-center sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1f6f68]">Driver onboarding</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-[#18211f] sm:text-5xl">
            Register as Driver
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[#66736f]">
            Submit your profile, vehicle details, and documents for admin verification.
          </p>
        </div>

        <div className="border border-[#e5e2d8] rounded-2xl bg-white shadow-sm p-6 sm:p-8 space-y-8">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 shadow-sm">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Personal Information */}
            <div className="gsap-card rounded-2xl border border-[#e5e2d8] bg-[#faf9f5] p-5 sm:p-6 shadow-sm">
              <h3 className="text-base font-bold text-[#18211f] border-b border-[#e5e2d8] pb-3 mb-5">Personal Information</h3>
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#49534f] mb-2">
                    Full Name <span className="text-[#b42318]">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-[#d9d4c6] bg-white px-4 py-3 text-[#18211f] placeholder-[#9aa09c] outline-none transition-all duration-300 focus:border-[#1f6f68] focus:ring-2 focus:ring-[#1f6f68]/15"
                    placeholder="e.g. Juan dela Cruz"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#49534f] mb-2">
                    Email Address <span className="text-[#b42318]">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-[#d9d4c6] bg-white px-4 py-3 text-[#18211f] placeholder-[#9aa09c] outline-none transition-all duration-300 focus:border-[#1f6f68] focus:ring-2 focus:ring-[#1f6f68]/15"
                    placeholder="e.g. juan@example.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#49534f] mb-2">
                    Phone Number <span className="text-[#b42318]">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-[#d9d4c6] bg-white px-4 py-3 text-[#18211f] placeholder-[#9aa09c] outline-none transition-all duration-300 focus:border-[#1f6f68] focus:ring-2 focus:ring-[#1f6f68]/15"
                    placeholder="09XXXXXXXXX"
                    maxLength={11}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Vehicle Information */}
            <div className="gsap-card rounded-2xl border border-[#e5e2d8] bg-[#faf9f5] p-5 sm:p-6 shadow-sm">
              <h3 className="text-base font-bold text-[#18211f] border-b border-[#e5e2d8] pb-3 mb-5">Vehicle Information</h3>
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#49534f] mb-2">
                    Vehicle Type <span className="text-[#b42318]">*</span>
                  </label>
                  <select
                    name="vehicleType"
                    value={formData.vehicleType}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-[#d9d4c6] bg-white px-4 py-3 text-[#18211f] outline-none transition-all duration-300 focus:border-[#1f6f68] focus:ring-2 focus:ring-[#1f6f68]/15 cursor-pointer"
                    required
                  >
                    <option value="motorcycle">Motorcycle</option>
                    <option value="tricycle">Tricycle</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#49534f] mb-2">
                    Vehicle Model <span className="text-[#b42318]">*</span>
                  </label>
                  <input
                    type="text"
                    name="vehicleModel"
                    value={formData.vehicleModel}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-[#d9d4c6] bg-white px-4 py-3 text-[#18211f] placeholder-[#9aa09c] outline-none transition-all duration-300 focus:border-[#1f6f68] focus:ring-2 focus:ring-[#1f6f68]/15"
                    placeholder="e.g. Honda TMX 125"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#49534f] mb-2">
                    Plate Number <span className="text-[#b42318]">*</span>
                  </label>
                  <input
                    type="text"
                    name="vehicleLicense"
                    value={formData.vehicleLicense}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-[#d9d4c6] bg-white px-4 py-3 text-[#18211f] placeholder-[#9aa09c] outline-none transition-all duration-300 focus:border-[#1f6f68] focus:ring-2 focus:ring-[#1f6f68]/15"
                    placeholder="e.g. 123 ABC or MV File No."
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#49534f] mb-2">
                    Tricycle Body Number / Vehicle ID <span className="text-[#b42318]">*</span>
                  </label>
                  <input
                    type="text"
                    name="vehicleNumber"
                    value={formData.vehicleNumber}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-[#d9d4c6] bg-white px-4 py-3 text-[#18211f] placeholder-[#9aa09c] outline-none transition-all duration-300 focus:border-[#1f6f68] focus:ring-2 focus:ring-[#1f6f68]/15"
                    placeholder="e.g. TRI-042"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Document Uploads */}
            <div className="gsap-card rounded-2xl border border-[#e5e2d8] bg-[#faf9f5] p-5 sm:p-6 shadow-sm">
              <h3 className="text-base font-bold text-[#18211f] border-b border-[#e5e2d8] pb-3 mb-5">Required Documents</h3>
              <div className="grid md:grid-cols-2 gap-5">
                {/* Driver's License */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#49534f] mb-2">
                    Driver&apos;s License Image <span className="text-[#b42318]">*</span>
                  </label>
                  <div className="border border-dashed border-[#cfc9bb] rounded-xl bg-white p-5 text-center transition-all duration-300 hover:border-[#1f6f68] hover:bg-[#1f6f68]/5 cursor-pointer shadow-sm">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, 'license')}
                      className="hidden"
                      id="license-upload"
                    />
                    <label htmlFor="license-upload" className="cursor-pointer block w-full">
                      {driverLicensePreview ? (
                        <div className="w-full">
                          <img
                            src={driverLicensePreview}
                            alt="License preview"
                            className="w-full h-36 object-cover rounded-lg mb-3 shadow-sm border border-[#e5e2d8]"
                          />
                          <p className="text-xs font-bold text-emerald-700 flex items-center justify-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Checked (Click to Replace)
                          </p>
                        </div>
                      ) : (
                        <div className="py-4">
                          <Upload className="w-8 h-8 text-[#66736f] mx-auto mb-2" />
                          <p className="text-xs font-bold text-[#18211f]">Click to upload License Photo</p>
                          <p className="text-[10px] text-[#66736f] mt-1">PNG, JPG up to 10MB</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* OR/CR */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#49534f] mb-2">
                    OR/CR Document Image <span className="text-[#b42318]">*</span>
                  </label>
                  <div className="border border-dashed border-[#cfc9bb] rounded-xl bg-white p-5 text-center transition-all duration-300 hover:border-[#1f6f68] hover:bg-[#1f6f68]/5 cursor-pointer shadow-sm">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, 'orcr')}
                      className="hidden"
                      id="orcr-upload"
                    />
                    <label htmlFor="orcr-upload" className="cursor-pointer block w-full">
                      {orCrPreview ? (
                        <div className="w-full">
                          <img
                            src={orCrPreview}
                            alt="OR/CR preview"
                            className="w-full h-36 object-cover rounded-lg mb-3 shadow-sm border border-[#e5e2d8]"
                          />
                          <p className="text-xs font-bold text-emerald-700 flex items-center justify-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Checked (Click to Replace)
                          </p>
                        </div>
                      ) : (
                        <div className="py-4">
                          <Upload className="w-8 h-8 text-[#66736f] mx-auto mb-2" />
                          <p className="text-xs font-bold text-[#18211f]">Click to upload OR/CR Photo</p>
                          <p className="text-[10px] text-[#66736f] mt-1">PNG, JPG up to 10MB</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="gsap-card rounded-2xl border border-[#e5e2d8] bg-[#faf9f5] p-5 sm:p-6 shadow-sm">
              <h3 className="text-base font-bold text-[#18211f] border-b border-[#e5e2d8] pb-3 mb-5">Account Security</h3>
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#49534f] mb-2">
                    Password <span className="text-[#b42318]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-[#d9d4c6] bg-white px-4 py-3 pr-12 text-[#18211f] placeholder-[#9aa09c] outline-none transition-all duration-300 focus:border-[#1f6f68] focus:ring-2 focus:ring-[#1f6f68]/15"
                      placeholder="Minimum 6 characters"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#66736f] hover:text-[#18211f]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#49534f] mb-2">
                    Confirm Password <span className="text-[#b42318]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-[#d9d4c6] bg-white px-4 py-3 pr-12 text-[#18211f] placeholder-[#9aa09c] outline-none transition-all duration-300 focus:border-[#1f6f68] focus:ring-2 focus:ring-[#1f6f68]/15"
                      placeholder="Re-enter password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#66736f] hover:text-[#18211f]"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms and Conditions */}
            <div className="flex items-start gap-3 bg-[#faf9f5] border border-[#e5e2d8] rounded-xl p-4 shadow-sm">
              <input
                type="checkbox"
                id="terms"
                checked={agreeToTerms}
                onChange={(e) => setAgreeToTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[#d9d4c6] text-[#1f6f68] focus:ring-[#1f6f68]/30 focus:ring-offset-0 accent-[#1f6f68] cursor-pointer"
              />
              <label htmlFor="terms" className="text-sm leading-relaxed text-[#66736f] cursor-pointer select-none">
                I agree to the <span className="font-semibold text-[#1f6f68] hover:underline">Terms of Service</span> and <span className="font-semibold text-[#1f6f68] hover:underline">Privacy Policy</span> for Drivers. I understand that my account requires admin approval.
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1f6f68] py-4 text-sm font-bold text-white shadow-sm transition-all duration-300 hover:bg-[#174c49] hover:shadow-md disabled:bg-zinc-300 disabled:text-zinc-500 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Registering...
                </>
              ) : (
                'Register as Driver'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
