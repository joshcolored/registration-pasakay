'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { getDatabase, ref, set } from 'firebase/database';

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

export default function DriverRegistrationPage() {
  const router = useRouter();
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

    // Validation
    if (!formData.name || !formData.email || !formData.phone || !formData.password) {
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

    if (!formData.phone.match(/^09\d{9}$/)) {
      setError('Phone number must be in format 09XX-XXX-XXXX');
      return;
    }

    if (!driverLicenseFile) {
      setError('Please upload your driver\'s license');
      return;
    }

    if (!orCrFile) {
      setError('Please upload your OR/CR document');
      return;
    }

    if (!agreeToTerms) {
      setError('Please agree to the Terms of Service');
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Create user account
      console.log('Creating user account...');
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;
      console.log('User created:', user.uid);

      // Step 2: Upload documents to Cloudinary
      let licenseUrl = 'pending_submission';
      let orCrUrl = 'pending_submission';

      if (driverLicenseFile) {
        try {
          console.log('Uploading driver license to Cloudinary...');
          licenseUrl = await uploadToCloudinary(driverLicenseFile, `pasakay/drivers/${user.uid}`);
          console.log('License uploaded:', licenseUrl);
        } catch (uploadError) {
          console.error('License upload error:', uploadError);
        }
      }

      if (orCrFile) {
        try {
          console.log('Uploading OR/CR to Cloudinary...');
          orCrUrl = await uploadToCloudinary(orCrFile, `pasakay/drivers/${user.uid}`);
          console.log('OR/CR uploaded:', orCrUrl);
        } catch (uploadError) {
          console.error('OR/CR upload error:', uploadError);
        }
      }

      // Step 3: Create driver data
      const driverData = {
        uid: user.uid,
        email: formData.email,
        name: formData.name,
        phone: formData.phone,
        userType: 'driver',
        role: 'driver',
        vehicleType: formData.vehicleType,
        vehicleNumber: formData.vehicleNumber,
        vehicleModel: formData.vehicleModel,
        vehicleLicense: formData.vehicleLicense,
        driverLicenseUrl: licenseUrl,
        orCrUrl: orCrUrl,
        isActive: true,
        isApproved: false,
        isOnline: false,
        verificationStatus: 'pending',
        createdAt: new Date().toISOString(),
        rating: 0,
        totalTrips: 0,
        totalEarnings: 0,
      };

      // Step 4: Save to database
      console.log('Saving to database...');
      await set(ref(database, `users/${user.uid}`), driverData);
      await set(ref(database, `drivers/${user.uid}`), driverData);
      console.log('Database saved successfully');

      // Step 5: Send email verification
      try {
        await sendEmailVerification(user);
        console.log('Verification email sent');
      } catch (emailError) {
        console.error('Email verification error:', emailError);
        // Continue even if email fails
      }

      // Sign out the user (they shouldn't be logged in yet)
      await auth.signOut();

      setSuccess(true);
    } catch (err: any) {
      console.error('Registration error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak');
      } else if (err.code === 'storage/unauthorized') {
        setError('Storage permission denied. Please contact admin.');
      } else if (err.code === 'PERMISSION_DENIED') {
        setError('Database permission denied. Please contact admin.');
      } else {
        setError(err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration Submitted!</h2>
          <p className="text-gray-600 mb-4">
            Your driver account has been created successfully.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-left">
            <p className="text-sm text-blue-900 font-medium mb-2">What&apos;s next?</p>
            <ol className="text-sm text-blue-800 space-y-2">
              <li>1. Check your email ({formData.email}) and verify your account</li>
              <li>2. Admin will review your documents</li>
              <li>3. You&apos;ll be notified once approved</li>
              <li>4. Download the Pasakay app and start driving!</li>
            </ol>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800">
              ⚠️ Your account requires admin approval before you can start accepting rides.
            </p>
          </div>
          <button
            onClick={() => router.push('/register')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.push('/register')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
        </div>
      </header>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Register as Driver
            </h1>
            <p className="text-gray-600">
              Fill in your details to start driving with Pasakay
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                    placeholder="Full Name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                    placeholder="name@example.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                    placeholder="09XXXXXXXXX"
                    maxLength={11}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Vehicle Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Vehicle Information</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vehicle Type <span className="text-red-600">*</span>
                  </label>
                  <select
                    name="vehicleType"
                    value={formData.vehicleType}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    required
                  >
                    <option value="motorcycle">Motorcycle</option>
                    <option value="tricycle">Tricycle</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vehicle Model <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="vehicleModel"
                    value={formData.vehicleModel}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                    placeholder="Honda TMX 155"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Plate Number <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="vehicleLicense"
                    value={formData.vehicleLicense}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                    placeholder="ABC 1234"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vehicle Number/ID <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="vehicleNumber"
                    value={formData.vehicleNumber}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                    placeholder="TRI-001"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Document Uploads */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Required Documents</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {/* Driver's License */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Driver&apos;s License <span className="text-red-600">*</span>
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-500 transition-colors cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, 'license')}
                      className="hidden"
                      id="license-upload"
                    />
                    <label htmlFor="license-upload" className="cursor-pointer">
                      {driverLicensePreview ? (
                        <div>
                          <img
                            src={driverLicensePreview}
                            alt="License preview"
                            className="w-full h-32 object-cover rounded mb-2"
                          />
                          <p className="text-sm text-green-600 font-medium">✓ Uploaded</p>
                        </div>
                      ) : (
                        <div>
                          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">Click to upload</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* OR/CR */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    OR/CR Document <span className="text-red-600">*</span>
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-500 transition-colors cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, 'orcr')}
                      className="hidden"
                      id="orcr-upload"
                    />
                    <label htmlFor="orcr-upload" className="cursor-pointer">
                      {orCrPreview ? (
                        <div>
                          <img
                            src={orCrPreview}
                            alt="OR/CR preview"
                            className="w-full h-32 object-cover rounded mb-2"
                          />
                          <p className="text-sm text-green-600 font-medium">✓ Uploaded</p>
                        </div>
                      ) : (
                        <div>
                          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">Click to upload</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Password */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Security</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10 text-gray-900 placeholder-gray-400"
                      placeholder="Minimum 6 characters"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10 text-gray-900 placeholder-gray-400"
                      placeholder="Re-enter password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms and Conditions */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="terms"
                checked={agreeToTerms}
                onChange={(e) => setAgreeToTerms(e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="terms" className="text-sm text-gray-700">
                I agree to the Terms of Service and Privacy Policy for Drivers. I understand that my account requires admin approval.
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-4 rounded-lg transition-colors flex items-center justify-center gap-2"
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
