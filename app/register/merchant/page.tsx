'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CakeSlice,
  CheckCircle,
  Coffee,
  Croissant,
  CupSoda,
  Eye,
  EyeOff,
  Pill,
  Sandwich,
  ShoppingBag,
  Store,
  Upload,
  Utensils,
} from 'lucide-react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, deleteUser, sendEmailVerification } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { getDatabase, ref, update } from 'firebase/database';
import { useRegisterScrollMotion } from '@/components/RegisterMotion';
import { createAdminNotification } from '@/lib/adminNotifications';

// Initialize Firebase
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

const validateImageFile = (file: File | null, label: string, required = false) => {
  if (!file) return required ? `${label} is required` : '';
  if (!file.type.startsWith('image/')) return `${label} must be an image file`;
  if (file.size > MAX_UPLOAD_SIZE_BYTES) return `${label} must be 10MB or smaller`;
  return '';
};

const merchantCategories = [
  { value: 'restaurant', label: 'Restaurant', icon: '🍽️' },
  { value: 'cafe', label: 'Cafe', icon: '☕' },
  { value: 'fastFood', label: 'Fast Food', icon: '🍔' },
  { value: 'bakery', label: 'Bakery', icon: '🥐' },
  { value: 'desserts', label: 'Desserts', icon: '🍰' },
  { value: 'drinks', label: 'Drinks', icon: '🥤' },
  { value: 'grocery', label: 'Grocery', icon: '🛒' },
];

const businessTypeOptions = [
  { value: 'food', label: 'Food', icon: '🍽️' },
  { value: 'vape', label: 'Vape Store', icon: '💨' },
  { value: 'medicine', label: 'Medicine', icon: '💊' },
] as const;

const merchantCategoriesByType = {
  food: [
    { value: 'restaurant', label: 'Restaurant', icon: '🍽️' },
    { value: 'cafe', label: 'Cafe', icon: '☕' },
    { value: 'fastFood', label: 'Fast Food', icon: '🍔' },
    { value: 'bakery', label: 'Bakery', icon: '🥐' },
    { value: 'desserts', label: 'Desserts', icon: '🍰' },
    { value: 'drinks', label: 'Drinks', icon: '🥤' },
    { value: 'grocery', label: 'Grocery', icon: '🛒' },
  ],
  vape: [
    { value: 'vapeStore', label: 'Vape Shop', icon: '💨' },
    { value: 'other', label: 'Other Vape Retail', icon: '🏪' },
  ],
  medicine: [
    { value: 'pharmacy', label: 'Pharmacy', icon: '💊' },
    { value: 'other', label: 'Medical Essentials', icon: '🏥' },
  ],
} as const;

const businessTypeIcons = {
  food: Utensils,
  vape: Store,
  medicine: Pill,
};

const categoryIcons = {
  restaurant: Utensils,
  cafe: Coffee,
  fastFood: Sandwich,
  bakery: Croissant,
  desserts: CakeSlice,
  drinks: CupSoda,
  grocery: ShoppingBag,
  vapeStore: Store,
  pharmacy: Pill,
  other: Store,
};

export default function MerchantRegistrationPage() {
  const router = useRouter();
  const pageRef = useRef<HTMLDivElement | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);
  useRegisterScrollMotion(pageRef);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [coordinateInput, setCoordinateInput] = useState('');
  const [locationLat, setLocationLat] = useState('');
  const [locationLng, setLocationLng] = useState('');
  const [locationStatus, setLocationStatus] = useState('');

  // Form fields
  const [formData, setFormData] = useState({
    businessName: '',
    ownerName: '',
    email: '',
    phone: '',
    address: '',
    description: '',
    businessType: 'food',
    category: 'restaurant',
    password: '',
    confirmPassword: '',
  });

  const categoryOptions =
    merchantCategoriesByType[
      formData.businessType as keyof typeof merchantCategoriesByType
    ] || merchantCategoriesByType.food;

  // File uploads
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [businessPermitFile, setBusinessPermitFile] = useState<File | null>(null);
  const [businessPermitPreview, setBusinessPermitPreview] = useState<string | null>(null);
  const [sanitaryPermitFile, setSanitaryPermitFile] = useState<File | null>(null);
  const [sanitaryPermitPreview, setSanitaryPermitPreview] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      if (name === 'businessType') {
        const nextCategories =
          merchantCategoriesByType[value as keyof typeof merchantCategoriesByType] ||
          merchantCategoriesByType.food;
        return {
          ...prev,
          businessType: value,
          category: nextCategories[0].value,
        };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'business' | 'sanitary') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'logo') {
          setLogoFile(file);
          setLogoPreview(reader.result as string);
        } else if (type === 'business') {
          setBusinessPermitFile(file);
          setBusinessPermitPreview(reader.result as string);
        } else {
          setSanitaryPermitFile(file);
          setSanitaryPermitPreview(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const defaultCenter = useMemo(() => ({ lat: 10.6765, lng: 122.9509 }), []);
  const parsedLat = parseFloat(locationLat);
  const parsedLng = parseFloat(locationLng);
  const mapCenter = useMemo(
    () =>
      Number.isNaN(parsedLat) || Number.isNaN(parsedLng)
        ? defaultCenter
        : { lat: parsedLat, lng: parsedLng },
    [parsedLat, parsedLng, defaultCenter]
  );
  const mapQuery =
    locationSearch.trim() ||
    formData.address.trim() ||
    formData.businessName.trim() ||
    `${mapCenter.lat},${mapCenter.lng}`;
  const googleMapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`;
  const googleMapUrl = `https://maps.google.com/?q=${encodeURIComponent(mapQuery)}`;

  const handleLocationSearch = async () => {
    const query = locationSearch.trim() || formData.address.trim() || formData.businessName.trim();

    if (!query) {
      setLocationStatus('Enter a business name or address to search.');
      return;
    }

    setLocationStatus('Searching location...');

    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: '1',
        addressdetails: '1',
      });
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Location search failed.');
      }

      const results = await response.json();
      if (!Array.isArray(results) || !results[0]) {
        setLocationStatus('Google preview updated. Coordinates were not found automatically, so enter latitude and longitude manually if needed.');
        return;
      }

      const lat = Number(results[0].lat);
      const lng = Number(results[0].lon);

      setLocationLat(lat.toFixed(6));
      setLocationLng(lng.toFixed(6));
      setLocationStatus(`Location found: ${results[0].display_name}`);
    } catch (err) {
      setLocationStatus('Location search failed. Please try again or enter coordinates manually.');
    }
  };

  const handleUsePastedCoordinates = () => {
    const text = coordinateInput.trim();

    if (!text) {
      setLocationStatus('Paste a Google Maps link or coordinates first.');
      return;
    }

    const patterns = [
      /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
      /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
      /q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
      /(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    ];

    const match = patterns
      .map((pattern) => text.match(pattern))
      .find(Boolean);

    if (!match) {
      setLocationStatus('Could not read coordinates. Copy text like "10.170843, 122.979512" or paste a Google Maps link.');
      return;
    }

    const lat = Number(match[1]);
    const lng = Number(match[2]);

    if (
      Number.isNaN(lat) ||
      Number.isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      setLocationStatus('Coordinates are invalid. Latitude must be -90 to 90 and longitude must be -180 to 180.');
      return;
    }

    setLocationLat(lat.toFixed(6));
    setLocationLng(lng.toFixed(6));
    setLocationStatus('Coordinates applied from pasted Google Maps link/text.');
  };

  const handleUseCurrentLocation = () => {
    setLocationStatus('');
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported by this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationLat(position.coords.latitude.toFixed(6));
        setLocationLng(position.coords.longitude.toFixed(6));
        setLocationStatus('Location captured from device.');
      },
      (err) => {
        setLocationStatus(err.message || 'Failed to get location.');
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
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

  const showFormError = (message: string) => {
    setError(message);
    requestAnimationFrame(() => {
      errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const businessName = formData.businessName.trim();
    const ownerName = formData.ownerName.trim();
    const email = formData.email.trim().toLowerCase();
    const phone = formData.phone.trim();
    const address = formData.address.trim();
    const description = formData.description.trim();

    // Validation
    if (!businessName || !ownerName || !email || !phone || !address || !formData.password) {
      showFormError('Please fill in all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      showFormError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      showFormError('Password must be at least 6 characters');
      return;
    }

    if (!phone.match(/^09\d{9}$/)) {
      showFormError('Phone number must be in format 09XX-XXX-XXXX');
      return;
    }

    const parsedLat = parseFloat(locationLat);
    const parsedLng = parseFloat(locationLng);
    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
      showFormError('Please set your business location using current location, coordinates, or the location search.');
      return;
    }

    const selectedBusinessPermitFile = businessPermitFile;
    if (!selectedBusinessPermitFile) {
      showFormError('Business permit image is required');
      return;
    }

    const businessPermitFileError = validateImageFile(selectedBusinessPermitFile, 'Business permit image', true);
    if (businessPermitFileError) {
      showFormError(businessPermitFileError);
      return;
    }

    const sanitaryPermitFileError = validateImageFile(sanitaryPermitFile, 'Sanitary permit image');
    if (sanitaryPermitFileError) {
      showFormError(sanitaryPermitFileError);
      return;
    }

    const logoFileError = validateImageFile(logoFile, 'Business logo');
    if (logoFileError) {
      showFormError(logoFileError);
      return;
    }

    if (!agreeToTerms) {
      showFormError('Please agree to the Terms of Service');
      return;
    }

    setIsLoading(true);
    let createdUser: FirebaseUser | null = null;
    let registrationSaved = false;

    try {
      // Create user account
      const userCredential = await createUserWithEmailAndPassword(auth, email, formData.password);
      const user = userCredential.user;
      createdUser = user;

      // Upload documents to Cloudinary
      const businessPermitUrl = await uploadToCloudinary(
        selectedBusinessPermitFile,
        `pasakay/merchants/${user.uid}`
      );
      let sanitaryPermitUrl: string | null = null;
      let logoUrl: string | null = null;

      console.log('Business permit uploaded:', businessPermitUrl);

      if (sanitaryPermitFile) {
        console.log('Uploading sanitary permit to Cloudinary...');
        sanitaryPermitUrl = await uploadToCloudinary(sanitaryPermitFile, `pasakay/merchants/${user.uid}`);
        console.log('Sanitary permit uploaded:', sanitaryPermitUrl);
      }

      if (logoFile) {
        console.log('Uploading logo to Cloudinary...');
        logoUrl = await uploadToCloudinary(logoFile, `pasakay/merchants/${user.uid}`);
        console.log('Logo uploaded:', logoUrl);
      }

      const now = new Date().toISOString();

      // Create user data
      const userData = {
        uid: user.uid,
        email,
        name: ownerName,
        phone,
        userType: 'merchant',
        role: 'merchant',
        isActive: true,
        isApproved: false,
        verificationStatus: 'pending',
        createdAt: now,
        updatedAt: now,
      };

      // Create merchant data
      const merchantData = {
        uid: user.uid,
        businessName,
        ownerName,
        email,
        phone,
        address,
        latitude: parsedLat,
        longitude: parsedLng,
        businessType: formData.businessType,
        category: formData.category,
        logoUrl: logoUrl || null,
        description: description || null,
        status: 'pending',
        isOpen: false,
        isActive: true,
        isApproved: false,
        rating: 0,
        totalOrders: 0,
        totalReviews: 0,
        deliveryFee: 0,
        estimatedPrepTime: 15,
        businessPermitUrl: businessPermitUrl,
        sanitaryPermitUrl: sanitaryPermitUrl || null,
        createdAt: now,
        updatedAt: now,
      };

      // Save to database
      await update(ref(database), {
        [`users/${user.uid}`]: userData,
        [`merchants/${user.uid}`]: merchantData,
      });
      registrationSaved = true;

      try {
        await createAdminNotification({
          title: 'New Merchant Registration',
          message: `${businessName} has registered as a merchant and needs review.`,
          type: 'merchantRegistration',
          relatedId: user.uid,
        });
      } catch (notificationError) {
        console.error('Admin notification error:', notificationError);
      }

      // Send email verification
      try {
        await sendEmailVerification(user);
      } catch (emailError) {
        console.error('Email verification error:', emailError);
      }

      // Sign out the user
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
          console.error('Failed to clean up incomplete merchant account:', cleanupError);
          cleanupWarning = ' Your login account may have been created; contact admin if retry says the email is already registered.';
        }
        try {
          await auth.signOut();
        } catch (signOutError) {
          console.error('Sign out error after failed registration:', signOutError);
        }
      }

      if (err.code === 'auth/email-already-in-use') {
        showFormError('This email is already registered');
      } else if (err.code === 'auth/invalid-email') {
        showFormError('Invalid email address');
      } else if (err.code === 'auth/weak-password') {
        showFormError('Password is too weak');
      } else if (err.code === 'PERMISSION_DENIED') {
        showFormError(`Database permission denied. Please contact admin.${cleanupWarning}`);
      } else {
        showFormError(`${err.message || 'Registration failed. Please try again.'}${cleanupWarning}`);
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
          <h2 className="mb-2 text-2xl font-semibold text-[#18211f]">Merchant Registration Submitted</h2>
          <p className="mb-4 text-[#66736f]">
            Your merchant account has been created successfully.
          </p>
          <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 p-4 text-left">
            <p className="mb-2 text-sm font-medium text-sky-900">What&apos;s next?</p>
            <ol className="space-y-2 text-sm text-sky-800">
              <li>1. Check your email ({formData.email}) and verify your account</li>
              <li>2. Admin will review your documents and business details</li>
              <li>3. You&apos;ll be notified once approved</li>
              <li>4. Download the Pasakay app and start managing orders!</li>
            </ol>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800">
              Your account requires admin approval before you can start accepting orders.
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
            className="inline-flex items-center gap-2 rounded-xl border border-[#d9d4c6] bg-white px-4 py-2 text-xs font-bold text-[#18211f] shadow-sm transition-all duration-300 hover:border-[#a46312]/30 hover:bg-[#faf9f5]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Registration Landing</span>
          </button>
        </div>
      </header>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="gsap-hero mb-8 p-6 text-center sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a46312]">Merchant onboarding</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-[#18211f] sm:text-5xl">
            Register as Merchant
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[#66736f]">
            Add your store details, location, category, and permits for faster review.
          </p>
        </div>

        <div className="border border-[#e5e2d8] rounded-2xl bg-white shadow-sm p-6 sm:p-8 space-y-8">
          {error && (
            <div ref={errorRef} className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 shadow-sm">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Business Type */}
            <div className="gsap-card rounded-2xl border border-[#e5e2d8] bg-[#faf9f5] p-5 sm:p-6 shadow-sm">
              <h3 className="text-base font-bold text-[#18211f] border-b border-[#e5e2d8] pb-3 mb-5">
                Business Type <span className="text-[#b42318]">*</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {businessTypeOptions.map((option) => {
                  const OptionIcon = businessTypeIcons[option.value] || Store;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        businessType: option.value,
                        category: merchantCategoriesByType[option.value][0].value,
                      }))}
                      className={`p-5 rounded-xl border-2 transition-all text-left cursor-pointer flex flex-col justify-between min-h-28 shadow-sm ${
                        formData.businessType === option.value
                          ? 'border-[#a46312] bg-[#a46312]/5 ring-2 ring-[#a46312]/20'
                          : 'border-[#d9d4c6] bg-white hover:border-[#a46312]/50'
                      }`}
                    >
                      <OptionIcon
                        className={`h-8 w-8 ${
                          formData.businessType === option.value ? 'text-[#a46312]' : 'text-[#66736f]'
                        }`}
                      />
                      <div className={`text-sm font-bold mt-3 ${
                        formData.businessType === option.value ? 'text-[#a46312]' : 'text-[#18211f]'
                      }`}>
                        {option.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Business Logo */}
            <div className="gsap-card rounded-2xl border border-[#e5e2d8] bg-[#faf9f5] p-5 sm:p-6 shadow-sm">
              <h3 className="text-base font-bold text-[#18211f] border-b border-[#e5e2d8] pb-3 mb-5">Business Logo</h3>
              <div className="flex justify-center">
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'logo')}
                    className="hidden"
                    id="logo-upload"
                  />
                  <label
                    htmlFor="logo-upload"
                    className="cursor-pointer block w-32 h-32 rounded-full border-2 border-dashed border-[#cfc9bb] bg-white hover:border-[#a46312] hover:bg-[#a46312]/5 transition-all duration-300 shadow-sm relative overflow-hidden"
                  >
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[#66736f]">
                        <Upload className="w-6 h-6 mb-1 text-[#66736f]" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Add Logo</span>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            </div>

            {/* Business Category */}
            <div className="gsap-card rounded-2xl border border-[#e5e2d8] bg-[#faf9f5] p-5 sm:p-6 shadow-sm">
              <h3 className="text-base font-bold text-[#18211f] border-b border-[#e5e2d8] pb-3 mb-5">
                Business Category <span className="text-[#b42318]">*</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {categoryOptions.map((cat) => {
                  const CategoryIcon = categoryIcons[cat.value] || Store;

                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, category: cat.value }))}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center text-center cursor-pointer shadow-sm ${
                        formData.category === cat.value
                          ? 'border-[#a46312] bg-[#a46312]/5 ring-2 ring-[#a46312]/20'
                          : 'border-[#d9d4c6] bg-white hover:border-[#a46312]/50'
                      }`}
                    >
                      <CategoryIcon
                        className={`mb-1 h-8 w-8 ${
                          formData.category === cat.value ? 'text-[#a46312]' : 'text-[#66736f]'
                        }`}
                      />
                      <div className={`text-xs font-bold mt-2 ${
                        formData.category === cat.value ? 'text-[#a46312]' : 'text-[#18211f]'
                      }`}>
                        {cat.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Business Information */}
            <div className="gsap-card rounded-2xl border border-[#e5e2d8] bg-[#faf9f5] p-5 sm:p-6 shadow-sm">
              <h3 className="text-base font-bold text-[#18211f] border-b border-[#e5e2d8] pb-3 mb-5">Business Information</h3>
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#49534f] mb-2">
                    Business Name <span className="text-[#b42318]">*</span>
                  </label>
                  <input
                    type="text"
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-[#d9d4c6] bg-white px-4 py-3 text-[#18211f] placeholder-[#9aa09c] outline-none transition-all duration-300 focus:border-[#a46312] focus:ring-2 focus:ring-[#a46312]/15"
                    placeholder="e.g. Pasakay Food Terminal"
                    required
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#49534f] mb-2">
                      Owner Name <span className="text-[#b42318]">*</span>
                    </label>
                    <input
                      type="text"
                      name="ownerName"
                      value={formData.ownerName}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-[#d9d4c6] bg-white px-4 py-3 text-[#18211f] placeholder-[#9aa09c] outline-none transition-all duration-300 focus:border-[#a46312] focus:ring-2 focus:ring-[#a46312]/15"
                      placeholder="e.g. Maria Clara"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#49534f] mb-2">
                      Owner Phone Number <span className="text-[#b42318]">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-[#d9d4c6] bg-white px-4 py-3 text-[#18211f] placeholder-[#9aa09c] outline-none transition-all duration-300 focus:border-[#a46312] focus:ring-2 focus:ring-[#a46312]/15"
                      placeholder="09XXXXXXXXX"
                      maxLength={11}
                      required
                    />
                  </div>
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
                    className="w-full rounded-xl border border-[#d9d4c6] bg-white px-4 py-3 text-[#18211f] placeholder-[#9aa09c] outline-none transition-all duration-300 focus:border-[#a46312] focus:ring-2 focus:ring-[#a46312]/15"
                    placeholder="e.g. branch@pasakay.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#49534f] mb-2">
                    Business Address <span className="text-[#b42318]">*</span>
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    rows={2}
                    className="w-full rounded-xl border border-[#d9d4c6] bg-white px-4 py-3 text-[#18211f] placeholder-[#9aa09c] outline-none transition-all duration-300 focus:border-[#a46312] focus:ring-2 focus:ring-[#a46312]/15 resize-none"
                    placeholder="Complete business street address, city, province"
                    required
                  />
                </div>

                {/* Map Section */}
                <div className="rounded-2xl border border-[#e5e2d8] bg-white p-5 shadow-sm space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-[#18211f]">Store Pin Location</p>
                      <p className="text-xs text-[#66736f] mt-0.5">Define your coordinates so customers can locate your store.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleUseCurrentLocation}
                      className="rounded-xl border border-[#a46312]/20 bg-[#a46312]/5 px-4 py-2.5 text-xs font-bold text-[#a46312] hover:bg-[#a46312]/10 transition-all duration-300 cursor-pointer shadow-sm"
                    >
                      Use Device Location
                    </button>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      type="text"
                      value={locationSearch}
                      onChange={(e) => setLocationSearch(e.target.value)}
                      className="min-w-0 flex-1 rounded-xl border border-[#d9d4c6] bg-white px-4 py-3 text-sm text-[#18211f] placeholder-[#9aa09c] outline-none transition-all focus:border-[#a46312] focus:ring-2 focus:ring-[#a46312]/15"
                      placeholder="e.g. SM City Bacolod or business street"
                    />
                    <button
                      type="button"
                      onClick={handleLocationSearch}
                      className="rounded-xl bg-[#a46312] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#86510d] cursor-pointer shadow-sm"
                    >
                      Search
                    </button>
                  </div>
                  <p className="text-[10px] text-[#66736f]">
                    Tip: Enter specific landmarks or street details for more precise automatic coordinates.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-[#66736f] uppercase tracking-wider mb-1.5">Latitude</label>
                      <input
                        type="text"
                        value={locationLat}
                        onChange={(e) => setLocationLat(e.target.value)}
                        className="w-full rounded-xl border border-[#d9d4c6] bg-white px-3 py-2.5 text-sm text-[#18211f] placeholder-[#9aa09c] outline-none transition-all focus:border-[#a46312] focus:ring-2 focus:ring-[#a46312]/15"
                        placeholder="10.676500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#66736f] uppercase tracking-wider mb-1.5">Longitude</label>
                      <input
                        type="text"
                        value={locationLng}
                        onChange={(e) => setLocationLng(e.target.value)}
                        className="w-full rounded-xl border border-[#d9d4c6] bg-white px-3 py-2.5 text-sm text-[#18211f] placeholder-[#9aa09c] outline-none transition-all focus:border-[#a46312] focus:ring-2 focus:ring-[#a46312]/15"
                        placeholder="122.950900"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <div className="h-64 w-full overflow-hidden rounded-xl border border-[#e5e2d8] bg-[#faf9f5] shadow-inner">
                      <iframe
                        key={googleMapSrc}
                        title="Business location Google Maps preview"
                        src={googleMapSrc}
                        className="h-full w-full border-0"
                        loading="lazy"
                      />
                    </div>
                    <div className="mt-2.5 flex flex-col gap-2 text-[11px] text-[#66736f] sm:flex-row sm:items-center sm:justify-between">
                      <p>Visual map center represents search query or coordinates above.</p>
                      <a
                        href={googleMapUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-[#a46312] hover:underline"
                      >
                        Open Google Maps
                      </a>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#e5e2d8] bg-[#faf9f5] p-4 space-y-2 shadow-inner">
                    <label className="block text-[11px] font-bold text-[#49534f] uppercase tracking-wider">
                      Paste coordinates or maps link directly
                    </label>
                    <div className="flex flex-col gap-2.5 sm:flex-row mt-1.5">
                      <input
                        type="text"
                        value={coordinateInput}
                        onChange={(e) => setCoordinateInput(e.target.value)}
                        className="min-w-0 flex-1 rounded-xl border border-[#d9d4c6] bg-white px-3 py-2.5 text-xs text-[#18211f] placeholder-[#9aa09c] outline-none transition-all focus:border-[#a46312] focus:ring-2 focus:ring-[#a46312]/15"
                        placeholder="e.g. 10.6765, 122.9509 or Google Maps URL"
                      />
                      <button
                        type="button"
                        onClick={handleUsePastedCoordinates}
                        className="rounded-xl border border-[#d9d4c6] bg-white px-4 py-2.5 text-xs font-bold text-[#18211f] shadow-sm transition hover:border-[#a46312]/50 hover:bg-[#faf9f5] cursor-pointer"
                      >
                        Apply Link
                      </button>
                    </div>
                  </div>
                  {locationStatus && (
                    <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 font-medium">{locationStatus}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#49534f] mb-2">
                    Business Description <span className="text-[#66736f] lowercase font-normal">(Optional)</span>
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full rounded-xl border border-[#d9d4c6] bg-white px-4 py-3 text-[#18211f] placeholder-[#9aa09c] outline-none transition-all duration-300 focus:border-[#a46312] focus:ring-2 focus:ring-[#a46312]/15 resize-none"
                    placeholder="Briefly describe what your store sells (e.g. Local filipino dishes and desserts)..."
                  />
                </div>
              </div>
            </div>

            {/* Required Documents */}
            <div className="gsap-card rounded-2xl border border-[#e5e2d8] bg-[#faf9f5] p-5 sm:p-6 shadow-sm">
              <h3 className="text-base font-bold text-[#18211f] border-b border-[#e5e2d8] pb-3 mb-5">Required Documents</h3>
              <div className="space-y-6">
                {/* Business Permit */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#49534f] mb-2">
                    Business Permit <span className="text-[#b42318]">*</span>
                  </label>
                  <div className="border-2 border-dashed border-[#cfc9bb] rounded-xl bg-white p-6 text-center hover:border-[#a46312] hover:bg-[#a46312]/5 transition-all duration-300 cursor-pointer shadow-sm">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, 'business')}
                      className="hidden"
                      id="business-permit-upload"
                    />
                    <label htmlFor="business-permit-upload" className="cursor-pointer block w-full">
                      {businessPermitPreview ? (
                        <div className="w-full">
                          <img
                            src={businessPermitPreview}
                            alt="Business permit preview"
                            className="max-w-xs mx-auto h-40 object-cover rounded-lg mb-3 shadow-sm border border-[#e5e2d8]"
                          />
                          <p className="text-xs font-bold text-emerald-700 flex items-center justify-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Checked (Click to Replace)
                          </p>
                        </div>
                      ) : (
                        <div>
                          <Upload className="w-10 h-10 text-[#66736f] mx-auto mb-2" />
                          <p className="text-xs font-bold text-[#18211f]">Click to upload Business Permit</p>
                          <p className="text-[10px] text-[#66736f] mt-1">PNG, JPG up to 10MB</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Sanitary Permit */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#49534f] mb-2">
                    Sanitary Permit <span className="text-[#66736f] lowercase font-normal">(Optional but recommended)</span>
                  </label>
                  <div className="border-2 border-dashed border-[#cfc9bb] rounded-xl bg-white p-6 text-center hover:border-[#a46312] hover:bg-[#a46312]/5 transition-all duration-300 cursor-pointer shadow-sm">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, 'sanitary')}
                      className="hidden"
                      id="sanitary-permit-upload"
                    />
                    <label htmlFor="sanitary-permit-upload" className="cursor-pointer block w-full">
                      {sanitaryPermitPreview ? (
                        <div className="w-full">
                          <img
                            src={sanitaryPermitPreview}
                            alt="Sanitary permit preview"
                            className="max-w-xs mx-auto h-40 object-cover rounded-lg mb-3 shadow-sm border border-[#e5e2d8]"
                          />
                          <p className="text-xs font-bold text-emerald-700 flex items-center justify-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Checked (Click to Replace)
                          </p>
                        </div>
                      ) : (
                        <div>
                          <Upload className="w-10 h-10 text-[#66736f] mx-auto mb-2" />
                          <p className="text-xs font-bold text-[#18211f]">Click to upload Sanitary Permit</p>
                          <p className="text-[10px] text-[#66736f] mt-1">PNG, JPG up to 10MB</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Security */}
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
                      className="w-full rounded-xl border border-[#d9d4c6] bg-white px-4 py-3 pr-12 text-[#18211f] placeholder-[#9aa09c] outline-none transition-all duration-300 focus:border-[#a46312] focus:ring-2 focus:ring-[#a46312]/15"
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
                      className="w-full rounded-xl border border-[#d9d4c6] bg-white px-4 py-3 pr-12 text-[#18211f] placeholder-[#9aa09c] outline-none transition-all duration-300 focus:border-[#a46312] focus:ring-2 focus:ring-[#a46312]/15"
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
                className="mt-1 h-4 w-4 rounded border-[#d9d4c6] text-[#a46312] focus:ring-[#a46312]/30 focus:ring-offset-0 accent-[#a46312] cursor-pointer"
              />
              <label htmlFor="terms" className="text-sm leading-relaxed text-[#66736f] cursor-pointer select-none">
                I agree to the <span className="font-semibold text-[#a46312] hover:underline">Terms of Service</span> and <span className="font-semibold text-[#a46312] hover:underline">Privacy Policy</span> for Merchants. I understand that my account requires admin approval.
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#a46312] py-4 text-sm font-bold text-white shadow-sm transition-all duration-300 hover:bg-[#86510d] hover:shadow-md disabled:bg-zinc-300 disabled:text-zinc-500 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Registering...
                </>
              ) : (
                'Register as Merchant'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
