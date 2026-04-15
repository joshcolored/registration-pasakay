'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { GoogleMap, Marker, useLoadScript } from '@react-google-maps/api';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { getDatabase, ref, set } from 'firebase/database';

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

export default function MerchantRegistrationPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [locationLat, setLocationLat] = useState('');
  const [locationLng, setLocationLng] = useState('');
  const [locationStatus, setLocationStatus] = useState('');

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  });

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

  const defaultCenter = useMemo(() => ({ lat: 10.2667, lng: 122.85 }), []);
  const parsedLat = parseFloat(locationLat);
  const parsedLng = parseFloat(locationLng);
  const mapCenter = useMemo(
    () =>
      Number.isNaN(parsedLat) || Number.isNaN(parsedLng)
        ? defaultCenter
        : { lat: parsedLat, lng: parsedLng },
    [parsedLat, parsedLng, defaultCenter]
  );

  const handleMapClick = (event: google.maps.MapMouseEvent) => {
    if (!event.latLng) return;
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    setLocationLat(lat.toFixed(6));
    setLocationLng(lng.toFixed(6));
    setLocationStatus('Location pinned on map.');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.businessName || !formData.ownerName || !formData.email || !formData.phone || !formData.address || !formData.password) {
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

    const parsedLat = parseFloat(locationLat);
    const parsedLng = parseFloat(locationLng);
    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
      setError('Please pin your business location on the map or use your current location.');
      return;
    }

    if (!businessPermitFile) {
      setError('Please upload your Business Permit');
      return;
    }

    if (!agreeToTerms) {
      setError('Please agree to the Terms of Service');
      return;
    }

    setIsLoading(true);

    try {
      // Create user account
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      // Upload documents to Cloudinary
      let businessPermitUrl = 'pending_submission';
      let sanitaryPermitUrl: string | null = null;
      let logoUrl: string | null = null;

      if (businessPermitFile) {
        try {
          console.log('Uploading business permit to Cloudinary...');
          businessPermitUrl = await uploadToCloudinary(businessPermitFile, `pasakay/merchants/${user.uid}`);
          console.log('Business permit uploaded:', businessPermitUrl);
        } catch (uploadError) {
          console.error('Business permit upload error:', uploadError);
        }
      }

      if (sanitaryPermitFile) {
        try {
          console.log('Uploading sanitary permit to Cloudinary...');
          sanitaryPermitUrl = await uploadToCloudinary(sanitaryPermitFile, `pasakay/merchants/${user.uid}`);
          console.log('Sanitary permit uploaded:', sanitaryPermitUrl);
        } catch (uploadError) {
          console.error('Sanitary permit upload error:', uploadError);
        }
      }

      if (logoFile) {
        try {
          console.log('Uploading logo to Cloudinary...');
          logoUrl = await uploadToCloudinary(logoFile, `pasakay/merchants/${user.uid}`);
          console.log('Logo uploaded:', logoUrl);
        } catch (uploadError) {
          console.error('Logo upload error:', uploadError);
        }
      }

      // Create user data
      const userData = {
        uid: user.uid,
        email: formData.email,
        name: formData.ownerName,
        phone: formData.phone,
        userType: 'merchant',
        role: 'merchant',
        isActive: true,
        createdAt: new Date().toISOString(),
      };

      // Create merchant data
      const merchantData = {
        uid: user.uid,
        businessName: formData.businessName,
        ownerName: formData.ownerName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        latitude: parsedLat,
        longitude: parsedLng,
        businessType: formData.businessType,
        category: formData.category,
        logoUrl: logoUrl || null,
        description: formData.description || null,
        status: 'pending',
        isOpen: false,
        rating: 0,
        totalOrders: 0,
        totalReviews: 0,
        deliveryFee: 0,
        estimatedPrepTime: 15,
        businessPermitUrl: businessPermitUrl,
        sanitaryPermitUrl: sanitaryPermitUrl || null,
        createdAt: new Date().toISOString(),
      };

      // Save to database
      await set(ref(database, `users/${user.uid}`), userData);
      await set(ref(database, `merchants/${user.uid}`), merchantData);

      // Send email verification
      await sendEmailVerification(user);

      // Sign out the user
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Merchant Registration Submitted!</h2>
          <p className="text-gray-600 mb-4">
            Your merchant account has been created successfully.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-left">
            <p className="text-sm text-blue-900 font-medium mb-2">What&apos;s next?</p>
            <ol className="text-sm text-blue-800 space-y-2">
              <li>1. Check your email ({formData.email}) and verify your account</li>
              <li>2. Admin will review your documents and business details</li>
              <li>3. You&apos;ll be notified once approved</li>
              <li>4. Download the Pasakay app and start managing orders!</li>
            </ol>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800">
              ⚠️ Your account requires admin approval before you can start accepting orders.
            </p>
          </div>
          <button
            onClick={() => router.push('/register')}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg transition-colors"
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
              Register as Merchant
            </h1>
            <p className="text-gray-600">
              Join Pasakay and start selling food, vape, or medicine products
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Type <span className="text-red-600">*</span></h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {businessTypeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      businessType: option.value,
                      category: merchantCategoriesByType[option.value][0].value,
                    }))}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      formData.businessType === option.value
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-2">{option.icon}</div>
                    <div className={`text-sm font-semibold ${
                      formData.businessType === option.value ? 'text-purple-600' : 'text-gray-800'
                    }`}>
                      {option.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Business Logo */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Logo</h3>
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
                    className="cursor-pointer block w-32 h-32 rounded-full border-2 border-dashed border-gray-300 hover:border-purple-500 transition-colors"
                  >
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                        <Upload className="w-8 h-8 mb-2" />
                        <span className="text-xs">Add Logo</span>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            </div>

            {/* Business Category */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Category <span className="text-red-600">*</span></h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {categoryOptions.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, category: cat.value }))}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      formData.category === cat.value
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-3xl mb-2">{cat.icon}</div>
                    <div className={`text-sm font-medium ${
                      formData.category === cat.value ? 'text-purple-600' : 'text-gray-700'
                    }`}>
                      {cat.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Business Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                    placeholder="Branch"
                    required
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Owner Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      name="ownerName"
                      value={formData.ownerName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                      placeholder="Owner Name"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                      placeholder="09XXXXXXXXX"
                      maxLength={11}
                      required
                    />
                  </div>
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                    placeholder="business@example.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Address <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                    placeholder="Complete business address"
                    required
                  />
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Business Location</p>
                      <p className="text-xs text-gray-500">Use your device location for delivery fee calculations.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleUseCurrentLocation}
                      className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100"
                    >
                      Use Current Location
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Latitude</label>
                      <input
                        type="text"
                        value={locationLat}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50"
                        placeholder="Use current location"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Longitude</label>
                      <input
                        type="text"
                        value={locationLng}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50"
                        placeholder="Use current location"
                        required
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    {loadError ? (
                      <p className="text-xs text-red-600">Failed to load Google Maps.</p>
                    ) : !isLoaded ? (
                      <p className="text-xs text-gray-500">Loading map...</p>
                    ) : (
                      <div className="h-64 w-full overflow-hidden rounded-lg border border-gray-200">
                        <GoogleMap
                          mapContainerStyle={{ width: '100%', height: '100%' }}
                          center={mapCenter}
                          zoom={15}
                          onClick={handleMapClick}
                          options={{
                            streetViewControl: false,
                            mapTypeControl: false,
                            fullscreenControl: false,
                          }}
                        >
                          {!Number.isNaN(parsedLat) && !Number.isNaN(parsedLng) && (
                            <Marker position={{ lat: parsedLat, lng: parsedLng }} />
                          )}
                        </GoogleMap>
                      </div>
                    )}
                  </div>
                  {locationStatus && (
                    <p className="mt-2 text-xs text-gray-600">{locationStatus}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Description (Optional)
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                    placeholder="Describe your business..."
                  />
                </div>
              </div>
            </div>

            {/* Required Documents */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Required Documents</h3>
              <div className="space-y-4">
                {/* Business Permit */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Permit * <span className="text-red-600">(Required)</span>
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-500 transition-colors cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, 'business')}
                      className="hidden"
                      id="business-permit-upload"
                    />
                    <label htmlFor="business-permit-upload" className="cursor-pointer">
                      {businessPermitPreview ? (
                        <div>
                          <img
                            src={businessPermitPreview}
                            alt="Business permit preview"
                            className="max-w-xs mx-auto h-40 object-cover rounded mb-2"
                          />
                          <p className="text-sm text-green-600 font-medium">✓ Business Permit Uploaded</p>
                        </div>
                      ) : (
                        <div>
                          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600 mb-1">Click to upload Business Permit</p>
                          <p className="text-xs text-gray-500">PNG, JPG up to 10MB</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Sanitary Permit */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sanitary Permit <span className="text-gray-500">(Optional but recommended)</span>
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-500 transition-colors cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, 'sanitary')}
                      className="hidden"
                      id="sanitary-permit-upload"
                    />
                    <label htmlFor="sanitary-permit-upload" className="cursor-pointer">
                      {sanitaryPermitPreview ? (
                        <div>
                          <img
                            src={sanitaryPermitPreview}
                            alt="Sanitary permit preview"
                            className="max-w-xs mx-auto h-40 object-cover rounded mb-2"
                          />
                          <p className="text-sm text-green-600 font-medium">✓ Sanitary Permit Uploaded</p>
                        </div>
                      ) : (
                        <div>
                          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600 mb-1">Click to upload Sanitary Permit</p>
                          <p className="text-xs text-gray-500">PNG, JPG up to 10MB</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Security */}
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10 text-gray-900 placeholder-gray-400"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10 text-gray-900 placeholder-gray-400"
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
                className="mt-1 w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <label htmlFor="terms" className="text-sm text-gray-700">
                I agree to the Terms of Service and Privacy Policy for Merchants. I understand that my account requires admin approval before I can start accepting orders.
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-4 rounded-lg transition-colors flex items-center justify-center gap-2"
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
