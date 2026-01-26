'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ref, get, update } from 'firebase/database';
import { database, auth } from '@/lib/firebase';
import { EmailAuthProvider, reauthenticateWithCredential, updateEmail, sendEmailVerification } from 'firebase/auth';
import { FareSettings, SupportSettings, AppSettings } from '@/types';
import { Save, DollarSign, Phone, Mail, User, CreditCard, Upload, X, Edit, Facebook, Clock, Headphones, ImageIcon, Wallet, Server, Lock, Send, Eye, EyeOff } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';

interface AdminProfile {
  name: string;
  email: string;
  phoneNumber: string;
}

interface PaymentSettings {
  gcashName: string;
  gcashNumber: string;
  gcashQrCodeUrl: string;
  updatedAt?: string;
  updatedBy?: string;
}

interface SubscriptionSettings {
  oneMonthPrice: number;
  threeMonthsPrice: number;
  oneMonthDays: number;
  threeMonthsDays: number;
  isEnabled: boolean;
  oneMonthDescription?: string;
  threeMonthsDescription?: string;
  oneMonthImageUrl?: string;
  threeMonthsImageUrl?: string;
}

interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  secure: boolean;
  hasPass?: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminUserId, setAdminUserId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingPlanImage, setUploadingPlanImage] = useState<'one' | 'three' | null>(null);
  const [selectedQrCode, setSelectedQrCode] = useState<File | null>(null);
  const [qrCodePreview, setQrCodePreview] = useState<string | null>(null);
  const [selectedLogo, setSelectedLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [selectedOneMonthImage, setSelectedOneMonthImage] = useState<File | null>(null);
  const [oneMonthImagePreview, setOneMonthImagePreview] = useState<string | null>(null);
  const [selectedThreeMonthImage, setSelectedThreeMonthImage] = useState<File | null>(null);
  const [threeMonthImagePreview, setThreeMonthImagePreview] = useState<string | null>(null);
  const [showChangeEmailDialog, setShowChangeEmailDialog] = useState(false);
  const [changeEmailData, setChangeEmailData] = useState({
    currentPassword: '',
    newEmail: '',
  });

  // Admin Profile
  const [adminProfile, setAdminProfile] = useState<AdminProfile>({
    name: '',
    email: '',
    phoneNumber: '',
  });

  // Payment Settings (GCash - stored in settings/payment)
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    gcashName: '',
    gcashNumber: '',
    gcashQrCodeUrl: '',
  });

  // Fare Settings
  const [fareSettings, setFareSettings] = useState<FareSettings>({
    baseFare: 0,
    per2KmRate: 0,
    perPassengerRate: 0,
    minimumFare: 0,
  });

  // Support Settings (matches Flutter app - stored in settings/support)
  const [supportSettings, setSupportSettings] = useState<SupportSettings>({
    email: '',
    phone: '',
    facebookUrl: '',
    facebookName: '',
    supportHours: '',
  });

  // App Settings (logo, branding - stored in settings/app)
  const [appSettings, setAppSettings] = useState<AppSettings>({
    logoUrl: '',
    appName: 'Pasakay',
  });

  // Subscription Settings (stored in settings/subscription)
  const [subscriptionSettings, setSubscriptionSettings] = useState<SubscriptionSettings>({
    oneMonthPrice: 150,
    threeMonthsPrice: 300,
    oneMonthDays: 30,
    threeMonthsDays: 90,
    isEnabled: true,
    oneMonthDescription: '',
    threeMonthsDescription: '',
    oneMonthImageUrl: '',
    threeMonthsImageUrl: '',
  });

  const [smtpSettings, setSmtpSettings] = useState<SmtpSettings>({
    host: '',
    port: 587,
    user: '',
    pass: '',
    fromEmail: '',
    fromName: '',
    secure: false,
    hasPass: false,
  });
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpTestEmail, setSmtpTestEmail] = useState('');
  const [smtpTestSending, setSmtpTestSending] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);

  useEffect(() => {
    // Check if admin is logged in
    const adminUser = localStorage.getItem('adminUser');
    if (!adminUser) {
      router.push('/pasakay/login');
      return;
    }

    const userData = JSON.parse(adminUser);
    setAdminUserId(userData.userId);
    loadSettings(userData.userId);
  }, [router]);

  const getIdToken = async () => {
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  };

  const loadSmtpSettings = async () => {
    setSmtpLoading(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch('/api/admin/smtp', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data?.data) {
        setSmtpSettings({
          host: data.data.host || '',
          port: data.data.port || 587,
          user: data.data.user || '',
          pass: '',
          fromEmail: data.data.fromEmail || '',
          fromName: data.data.fromName || '',
          secure: data.data.secure === true,
          hasPass: data.data.hasPass === true,
        });
      }
    } catch (error) {
      console.error('Error loading SMTP settings:', error);
    } finally {
      setSmtpLoading(false);
    }
  };

  const loadSettings = async (userId: string) => {
    try {
      // Load Admin Profile
      const adminRef = ref(database, `users/${userId}`);
      const adminSnapshot = await get(adminRef);
      if (adminSnapshot.exists()) {
        const data = adminSnapshot.val();
        console.log('Loaded admin profile:', data);
        setAdminProfile({
          name: data.name || '',
          email: data.email || '',
          phoneNumber: data.phoneNumber || '',
        });
        setSmtpTestEmail((prev) => prev || data.email || '');
      }

      // Load Payment Settings (GCash) from settings/payment (matching Flutter app)
      const paymentRef = ref(database, 'settings/payment');
      const paymentSnapshot = await get(paymentRef);
      if (paymentSnapshot.exists()) {
        const data = paymentSnapshot.val();
        console.log('Loaded payment settings:', data);
        setPaymentSettings({
          gcashName: data.gcashName || '',
          gcashNumber: data.gcashNumber || '',
          gcashQrCodeUrl: data.gcashQrCodeUrl || '',
          updatedAt: data.updatedAt || '',
          updatedBy: data.updatedBy || '',
        });
      }

      // Load Fare Settings from settings/fare (matching Flutter app)
      const fareRef = ref(database, 'settings/fare');
      const fareSnapshot = await get(fareRef);
      if (fareSnapshot.exists()) {
        const data = fareSnapshot.val();
        console.log('Loaded fare settings:', data);
        setFareSettings({
          baseFare: data.baseFare || 0,
          per2KmRate: data.per2KilometersRate || 0,
          perPassengerRate: data.perPassengerRate || 0,
          minimumFare: data.minimumFare || 0,
        });
      }

      // Load Support Settings from settings/support (matching Flutter app)
      const supportRef = ref(database, 'settings/support');
      const supportSnapshot = await get(supportRef);
      if (supportSnapshot.exists()) {
        const data = supportSnapshot.val();
        console.log('Loaded support settings:', data);
        setSupportSettings({
          email: data.email || 'support@pasakay.com',
          phone: data.phone || '+63 123 456 7890',
          facebookUrl: data.facebookUrl || 'https://facebook.com/pasakay',
          facebookName: data.facebookName || 'Pasakay Official',
          supportHours: data.supportHours || 'Monday - Sunday\n8:00 AM - 8:00 PM',
        });
      }

      // Load App Settings (logo) from settings/app
      const appRef = ref(database, 'settings/app');
      const appSnapshot = await get(appRef);
      if (appSnapshot.exists()) {
        const data = appSnapshot.val();
        console.log('Loaded app settings:', data);
        setAppSettings({
          logoUrl: data.logoUrl || '',
          appName: data.appName || 'Pasakay',
        });
      }

      // Load Subscription Settings from settings/subscription
      const subscriptionRef = ref(database, 'settings/subscription');
      const subscriptionSnapshot = await get(subscriptionRef);
      if (subscriptionSnapshot.exists()) {
        const data = subscriptionSnapshot.val();
        console.log('Loaded subscription settings:', data);
        setSubscriptionSettings({
          oneMonthPrice: data.oneMonthPrice || 150,
          threeMonthsPrice: data.threeMonthsPrice || 300,
          oneMonthDays: data.oneMonthDays || 30,
          threeMonthsDays: data.threeMonthsDays || 90,
          isEnabled: data.isEnabled !== false,
          oneMonthDescription: data.oneMonthDescription || '',
          threeMonthsDescription: data.threeMonthsDescription || '',
          oneMonthImageUrl: data.oneMonthImageUrl || '',
          threeMonthsImageUrl: data.threeMonthsImageUrl || '',
        });
      }

      await loadSmtpSettings();

      setLoading(false);
    } catch (error) {
      console.error('Error loading settings:', error);
      setLoading(false);
    }
  };

  const handleSaveAdminProfile = async () => {
    if (!confirm('Save admin profile?')) return;

    setSaving(true);
    try {
      const adminRef = ref(database, `users/${adminUserId}`);
      await update(adminRef, {
        name: adminProfile.name,
        phoneNumber: adminProfile.phoneNumber,
        lastUpdated: Date.now()
      });

      // Update localStorage with new name
      const adminUser = localStorage.getItem('adminUser');
      if (adminUser) {
        const userData = JSON.parse(adminUser);
        userData.name = adminProfile.name;
        localStorage.setItem('adminUser', JSON.stringify(userData));
      }

      alert('Admin profile saved successfully!');
    } catch (error) {
      console.error('Error saving admin profile:', error);
      alert('Failed to save admin profile');
    }
    setSaving(false);
  };

  const handleQrCodeSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }

      setSelectedQrCode(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setQrCodePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadQrCode = async () => {
    if (!selectedQrCode) {
      alert('Please select a QR code image first');
      return;
    }

    if (!confirm('Upload this QR code?')) return;

    setUploading(true);
    try {
      // Upload to Cloudinary
      const formData = new FormData();
      formData.append('file', selectedQrCode);
      formData.append('upload_preset', 'pasakay_gcash_qr'); // You'll need to create this preset in Cloudinary
      formData.append('folder', 'gcash_qr_codes');

      const response = await fetch(
        'https://api.cloudinary.com/v1_1/drvtezcke/image/upload', // Your Cloudinary cloud name
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      const imageUrl = data.secure_url;

      // Update Firebase with the new QR code URL in settings/payment
      const paymentRef = ref(database, 'settings/payment');
      await update(paymentRef, {
        gcashQrCodeUrl: imageUrl,
        updatedAt: new Date().toISOString(),
        updatedBy: adminUserId
      });

      // Update local state
      setPaymentSettings({ ...paymentSettings, gcashQrCodeUrl: imageUrl });
      setSelectedQrCode(null);
      setQrCodePreview(null);

      alert('QR code uploaded successfully!');
    } catch (error) {
      console.error('Error uploading QR code:', error);
      alert('Failed to upload QR code. Please try again.');
    }
    setUploading(false);
  };

  const handleRemoveQrCode = async () => {
    if (!confirm('Remove the current QR code?')) return;

    setSaving(true);
    try {
      const paymentRef = ref(database, 'settings/payment');
      await update(paymentRef, {
        gcashQrCodeUrl: '',
        updatedAt: new Date().toISOString(),
        updatedBy: adminUserId
      });

      // Update local state
      setPaymentSettings({ ...paymentSettings, gcashQrCodeUrl: '' });
      setSelectedQrCode(null);
      setQrCodePreview(null);

      alert('QR code removed successfully!');
    } catch (error) {
      console.error('Error removing QR code:', error);
      alert('Failed to remove QR code');
    }
    setSaving(false);
  };

  const handleSaveGCashSettings = async () => {
    // Validate GCash inputs
    if (!paymentSettings.gcashName || paymentSettings.gcashName.trim() === '') {
      alert('GCash account name is required');
      return;
    }

    if (!paymentSettings.gcashNumber || paymentSettings.gcashNumber.trim() === '') {
      alert('GCash number is required');
      return;
    }

    // Validate GCash number format (should be 11 digits starting with 09)
    if (!paymentSettings.gcashNumber.match(/^09\d{9}$/)) {
      alert('Invalid GCash number format. Should be 09XXXXXXXXX (11 digits)');
      return;
    }

    if (!confirm('Update GCash payment settings?')) return;

    setSaving(true);
    try {
      // Save to settings/payment (matching Flutter app)
      const paymentRef = ref(database, 'settings/payment');
      await update(paymentRef, {
        gcashName: paymentSettings.gcashName.trim(),
        gcashNumber: paymentSettings.gcashNumber.trim(),
        gcashQrCodeUrl: paymentSettings.gcashQrCodeUrl || '',
        updatedAt: new Date().toISOString(),
        updatedBy: adminUserId
      });

      alert('GCash settings updated successfully!');
    } catch (error) {
      console.error('Error saving GCash settings:', error);
      alert('Failed to save GCash settings');
    }
    setSaving(false);
  };

  const handleSaveFareSettings = async () => {
    // Validate minimum fare
    if (fareSettings.minimumFare < fareSettings.baseFare) {
      alert('Minimum fare cannot be less than base fare');
      return;
    }

    if (!confirm('Save fare settings?')) return;

    setSaving(true);
    try {
      // Save to settings/fare (matching Flutter app)
      const fareRef = ref(database, 'settings/fare');
      await update(fareRef, {
        baseFare: fareSettings.baseFare,
        per2KilometersRate: fareSettings.per2KmRate,
        perPassengerRate: fareSettings.perPassengerRate,
        minimumFare: fareSettings.minimumFare,
        updatedAt: new Date().toISOString()
      });
      alert('Fare settings saved successfully!');
    } catch (error) {
      console.error('Error saving fare settings:', error);
      alert('Failed to save fare settings');
    }
    setSaving(false);
  };

  const handleSaveSupportSettings = async () => {
    // Validate inputs
    if (!supportSettings.email || supportSettings.email.trim() === '') {
      alert('Support email is required');
      return;
    }
    if (!supportSettings.phone || supportSettings.phone.trim() === '') {
      alert('Support phone is required');
      return;
    }

    if (!confirm('Save support settings?')) return;

    setSaving(true);
    try {
      // Save to settings/support (matching Flutter app)
      const supportRef = ref(database, 'settings/support');
      await update(supportRef, {
        email: supportSettings.email.trim(),
        phone: supportSettings.phone.trim(),
        facebookUrl: supportSettings.facebookUrl.trim(),
        facebookName: supportSettings.facebookName.trim(),
        supportHours: supportSettings.supportHours.trim(),
      });
      alert('Support settings saved successfully!');
    } catch (error) {
      console.error('Error saving support settings:', error);
      alert('Failed to save support settings');
    }
    setSaving(false);
  };

  const handleSaveSmtpSettings = async () => {
    if (!smtpSettings.host.trim() || !smtpSettings.user.trim() || !smtpSettings.fromEmail.trim()) {
      alert('SMTP host, username, and from email are required');
      return;
    }
    if (!smtpSettings.pass && !smtpSettings.hasPass) {
      alert('SMTP password is required');
      return;
    }
    if (!confirm('Save SMTP settings?')) return;

    setSmtpSaving(true);
    try {
      const token = await getIdToken();
      if (!token) {
        alert('Admin session expired. Please login again.');
        return;
      }
      const res = await fetch('/api/admin/smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          host: smtpSettings.host.trim(),
          port: smtpSettings.port,
          user: smtpSettings.user.trim(),
          pass: smtpSettings.pass,
          fromEmail: smtpSettings.fromEmail.trim(),
          fromName: smtpSettings.fromName.trim(),
          secure: smtpSettings.secure,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to save SMTP settings');
        return;
      }
      setSmtpSettings({
        ...smtpSettings,
        pass: '',
        hasPass: true,
      });
      alert('SMTP settings saved successfully!');
    } catch (error) {
      console.error('Error saving SMTP settings:', error);
      alert('Failed to save SMTP settings');
    } finally {
      setSmtpSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!smtpTestEmail.trim()) {
      alert('Enter a test email address');
      return;
    }
    setSmtpTestSending(true);
    try {
      const token = await getIdToken();
      if (!token) {
        alert('Admin session expired. Please login again.');
        return;
      }
      const res = await fetch('/api/admin/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: smtpTestEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to send test email');
        return;
      }
      alert('Test email sent successfully!');
    } catch (error) {
      console.error('Error sending test email:', error);
      alert('Failed to send test email');
    } finally {
      setSmtpTestSending(false);
    }
  };

  const handleSaveSubscriptionSettings = async () => {
    // Validate inputs
    if (subscriptionSettings.oneMonthPrice <= 0) {
      alert('1 Month price must be greater than 0');
      return;
    }
    if (subscriptionSettings.threeMonthsPrice <= 0) {
      alert('3 Months price must be greater than 0');
      return;
    }

    if (!confirm('Save subscription settings?')) return;

    setSaving(true);
    try {
      const subscriptionRef = ref(database, 'settings/subscription');
      await update(subscriptionRef, {
        oneMonthPrice: subscriptionSettings.oneMonthPrice,
        threeMonthsPrice: subscriptionSettings.threeMonthsPrice,
        oneMonthDays: subscriptionSettings.oneMonthDays,
        threeMonthsDays: subscriptionSettings.threeMonthsDays,
        isEnabled: subscriptionSettings.isEnabled,
        oneMonthDescription: subscriptionSettings.oneMonthDescription || '',
        threeMonthsDescription: subscriptionSettings.threeMonthsDescription || '',
        oneMonthImageUrl: subscriptionSettings.oneMonthImageUrl || '',
        threeMonthsImageUrl: subscriptionSettings.threeMonthsImageUrl || '',
        updatedAt: new Date().toISOString()
      });
      alert('Subscription settings saved successfully!');
    } catch (error) {
      console.error('Error saving subscription settings:', error);
      alert('Failed to save subscription settings');
    }
    setSaving(false);
  };

  // Calculate savings for 3-month plan
  const calculateSavings = () => {
    return (subscriptionSettings.oneMonthPrice * 3) - subscriptionSettings.threeMonthsPrice;
  };

  // Logo Upload Functions
  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      // Validate file size (max 500KB recommended for base64 storage)
      if (file.size > 500 * 1024) {
        const confirmLarge = confirm(
          `Image size is ${(file.size / 1024).toFixed(0)}KB. ` +
          'For best performance, we recommend images under 500KB. ' +
          'Continue anyway?'
        );
        if (!confirmLarge) return;
      }

      setSelectedLogo(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadLogo = async () => {
    if (!selectedLogo) {
      alert('Please select a logo image first');
      return;
    }

    if (!confirm('Upload this logo?')) return;

    setUploadingLogo(true);
    try {
      let imageUrl = '';
      
      // Try Cloudinary upload first
      try {
        const formData = new FormData();
        formData.append('file', selectedLogo);
        formData.append('upload_preset', 'pasakay_gcash_qr');
        formData.append('folder', 'app_logos');

        const response = await fetch(
          'https://api.cloudinary.com/v1_1/drvtezcke/image/upload',
          {
            method: 'POST',
            body: formData,
          }
        );

        if (response.ok) {
          const data = await response.json();
          imageUrl = data.secure_url;
        } else {
          const errorData = await response.json();
          console.error('Cloudinary error:', errorData);
          throw new Error(errorData.error?.message || 'Cloudinary upload failed');
        }
      } catch (cloudinaryError) {
        console.log('Cloudinary failed, using base64 fallback:', cloudinaryError);
        
        // Fallback: Convert to base64 and store in Firebase
        // This works for smaller images (recommended < 1MB)
        if (selectedLogo.size > 1024 * 1024) {
          alert('For images larger than 1MB, please contact support to set up cloud storage. Using compressed version.');
        }
        
        // Convert to base64
        const reader = new FileReader();
        imageUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(selectedLogo);
        });
      }

      if (!imageUrl) {
        throw new Error('Failed to process image');
      }

      // Update Firebase with the logo URL (or base64)
      const appRef = ref(database, 'settings/app');
      await update(appRef, {
        logoUrl: imageUrl,
        updatedAt: new Date().toISOString(),
        updatedBy: adminUserId
      });

      // Update local state
      setAppSettings({ ...appSettings, logoUrl: imageUrl });
      setSelectedLogo(null);
      setLogoPreview(null);

      alert('Logo uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      alert('Failed to upload logo: ' + (error.message || 'Unknown error'));
    }
    setUploadingLogo(false);
  };

  const handleRemoveLogo = async () => {
    if (!confirm('Remove the current logo?')) return;

    setSaving(true);
    try {
      const appRef = ref(database, 'settings/app');
      await update(appRef, {
        logoUrl: null, // Set to null to properly remove
        updatedAt: new Date().toISOString(),
        updatedBy: adminUserId
      });

      // Update local state
      setAppSettings({ ...appSettings, logoUrl: '' });
      setSelectedLogo(null);
      setLogoPreview(null);
      
      // Clear cache
      localStorage.removeItem('cachedLogoUrl');

      alert('Logo removed successfully!');
    } catch (error) {
      console.error('Error removing logo:', error);
      alert('Failed to remove logo');
    }
    setSaving(false);
  };

  const handlePlanImageSelect = (plan: 'one' | 'three', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (plan === 'one') {
        setSelectedOneMonthImage(file);
        setOneMonthImagePreview(reader.result as string);
      } else {
        setSelectedThreeMonthImage(file);
        setThreeMonthImagePreview(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUploadPlanImage = async (plan: 'one' | 'three') => {
    const selectedFile = plan === 'one' ? selectedOneMonthImage : selectedThreeMonthImage;
    if (!selectedFile) {
      alert('Please select an image first');
      return;
    }

    if (!confirm('Upload this plan image?')) return;

    setUploadingPlanImage(plan);
    try {
      let imageUrl = '';

      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('upload_preset', 'pasakay_gcash_qr');
        formData.append('folder', 'subscription_plans');

        const response = await fetch(
          'https://api.cloudinary.com/v1_1/drvtezcke/image/upload',
          {
            method: 'POST',
            body: formData,
          }
        );

        if (response.ok) {
          const data = await response.json();
          imageUrl = data.secure_url;
        } else {
          const errorData = await response.json();
          console.error('Cloudinary error:', errorData);
          throw new Error(errorData.error?.message || 'Cloudinary upload failed');
        }
      } catch (cloudinaryError) {
        console.log('Cloudinary failed, using base64 fallback:', cloudinaryError);
        const reader = new FileReader();
        imageUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });
      }

      if (!imageUrl) {
        throw new Error('Failed to process image');
      }

      const subscriptionRef = ref(database, 'settings/subscription');
      await update(subscriptionRef, {
        ...(plan === 'one' ? { oneMonthImageUrl: imageUrl } : { threeMonthsImageUrl: imageUrl }),
        updatedAt: new Date().toISOString(),
      });

      setSubscriptionSettings({
        ...subscriptionSettings,
        ...(plan === 'one' ? { oneMonthImageUrl: imageUrl } : { threeMonthsImageUrl: imageUrl }),
      });

      if (plan === 'one') {
        setSelectedOneMonthImage(null);
        setOneMonthImagePreview(null);
      } else {
        setSelectedThreeMonthImage(null);
        setThreeMonthImagePreview(null);
      }

      alert('Plan image uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading plan image:', error);
      alert('Failed to upload plan image: ' + (error.message || 'Unknown error'));
    } finally {
      setUploadingPlanImage(null);
    }
  };

  const handleRemovePlanImage = async (plan: 'one' | 'three') => {
    if (!confirm('Remove the plan image?')) return;

    setSaving(true);
    try {
      const subscriptionRef = ref(database, 'settings/subscription');
      await update(subscriptionRef, {
        ...(plan === 'one' ? { oneMonthImageUrl: '' } : { threeMonthsImageUrl: '' }),
        updatedAt: new Date().toISOString(),
      });

      setSubscriptionSettings({
        ...subscriptionSettings,
        ...(plan === 'one' ? { oneMonthImageUrl: '' } : { threeMonthsImageUrl: '' }),
      });

      if (plan === 'one') {
        setSelectedOneMonthImage(null);
        setOneMonthImagePreview(null);
      } else {
        setSelectedThreeMonthImage(null);
        setThreeMonthImagePreview(null);
      }

      alert('Plan image removed successfully!');
    } catch (error) {
      console.error('Error removing plan image:', error);
      alert('Failed to remove plan image');
    } finally {
      setSaving(false);
    }
  };

  const handleChangeEmail = async () => {
    const { currentPassword, newEmail } = changeEmailData;

    // Validate inputs
    if (!currentPassword || currentPassword.trim() === '') {
      alert('Please enter your current password');
      return;
    }

    if (!newEmail || newEmail.trim() === '') {
      alert('Please enter new email address');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      alert('Please enter a valid email address');
      return;
    }

    if (!confirm(`Change email to ${newEmail}? You'll need to verify your new email address.`)) {
      return;
    }

    setSaving(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        alert('User not found. Please login again.');
        setSaving(false);
        return;
      }

      const currentEmail = user.email;

      // Re-authenticate user first (required for security)
      const credential = EmailAuthProvider.credential(currentEmail, currentPassword);

      await reauthenticateWithCredential(user, credential);

      // Update email in Firebase Authentication
      await updateEmail(user, newEmail);

      // Update email in Database
      const adminRef = ref(database, `users/${adminUserId}`);
      await update(adminRef, {
        email: newEmail,
        lastUpdated: Date.now()
      });

      // Update local state
      setAdminProfile({ ...adminProfile, email: newEmail });

      // Update localStorage
      const adminUser = localStorage.getItem('adminUser');
      if (adminUser) {
        const userData = JSON.parse(adminUser);
        userData.email = newEmail;
        localStorage.setItem('adminUser', JSON.stringify(userData));
      }

      // Send verification email to new address
      try {
        await sendEmailVerification(user);
        alert('Email changed successfully! Please check your inbox to verify your new email.');
      } catch (verifyError) {
        console.error('Verification email error:', verifyError);
        alert('Email changed but verification email failed to send. Please check your email settings.');
      }

      // Close dialog and reset form
      setShowChangeEmailDialog(false);
      setChangeEmailData({ currentPassword: '', newEmail: '' });

    } catch (error: any) {
      console.error('Error changing email:', error);

      // Handle specific errors
      if (error.code === 'auth/wrong-password') {
        alert('Current password is incorrect');
      } else if (error.code === 'auth/email-already-in-use') {
        alert('This email is already in use by another account');
      } else if (error.code === 'auth/requires-recent-login') {
        alert('Please logout and login again before changing email');
      } else if (error.code === 'auth/invalid-email') {
        alert('Invalid email format');
      } else {
        alert('Failed to change email: ' + (error.message || 'Unknown error'));
      }
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-black mb-2">Settings</h1>
          <p className="text-black font-semibold">Configure your profile, fare rates, and contact information</p>
        </div>

        {/* App Logo Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-black">App Logo</h2>
              <p className="text-sm text-gray-600">Upload your app logo for login page and sidebar</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Current Logo Preview */}
            <div>
              <label className="block text-sm font-bold text-black mb-2">
                Current Logo
              </label>
              {appSettings.logoUrl && !logoPreview ? (
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                  <div className="flex items-center justify-center mb-3">
                    <img
                      src={appSettings.logoUrl}
                      alt="App Logo"
                      className="w-32 h-32 object-contain bg-white rounded-lg shadow"
                    />
                  </div>
                  <div className="flex justify-center">
                    <button
                      onClick={handleRemoveLogo}
                      disabled={saving}
                      className="flex items-center space-x-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition disabled:opacity-50 text-sm"
                    >
                      <X className="w-4 h-4" />
                      <span className="font-semibold">Remove Logo</span>
                    </button>
                  </div>
                </div>
              ) : !logoPreview ? (
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-6 text-center">
                  <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-black mb-2">No Logo Uploaded</p>
                  <p className="text-xs text-gray-600">Upload a logo to display on login page and sidebar</p>
                </div>
              ) : null}
            </div>

            {/* Upload New Logo */}
            <div>
              <label className="block text-sm font-bold text-black mb-2">
                Upload New Logo
              </label>
              
              {/* New Logo Preview */}
              {logoPreview && (
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-4">
                  <p className="text-sm font-semibold text-black mb-3">Preview</p>
                  <div className="flex items-center justify-center mb-3">
                    <img
                      src={logoPreview}
                      alt="Logo Preview"
                      className="w-32 h-32 object-contain bg-white rounded-lg shadow"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleUploadLogo}
                      disabled={uploadingLogo}
                      className="flex items-center justify-center space-x-2 bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-600 transition disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4" />
                      <span className="font-semibold">{uploadingLogo ? 'Uploading...' : 'Upload'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedLogo(null);
                        setLogoPreview(null);
                      }}
                      disabled={uploadingLogo}
                      className="flex items-center justify-center space-x-2 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                      <span className="font-semibold">Cancel</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Upload Button */}
              {!logoPreview && (
                <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    id="logoInput"
                    accept="image/*"
                    onChange={handleLogoSelect}
                    className="hidden"
                  />
                  <label
                    htmlFor="logoInput"
                    className="cursor-pointer"
                  >
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-black mb-2">Click to upload logo</p>
                    <p className="text-xs text-gray-600">PNG, JPG up to 2MB</p>
                    <p className="text-xs text-gray-500 mt-2">Recommended: Square image (e.g., 512x512)</p>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Admin Profile Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-black">Admin Profile</h2>
                <p className="text-sm text-gray-600">Manage your account information</p>
              </div>
            </div>
            <button
              onClick={handleSaveAdminProfile}
              disabled={saving}
              className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white px-4 py-2 rounded-lg hover:from-purple-600 hover:to-pink-700 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span className="font-semibold">Save Profile</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-black mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={adminProfile.name}
                onChange={(e) => setAdminProfile({ ...adminProfile, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-black font-semibold placeholder-gray-400"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-black mb-2">
                Email Address
              </label>
              <div className="flex space-x-2">
                <input
                  type="email"
                  value={adminProfile.email}
                  disabled
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 font-semibold cursor-not-allowed"
                  placeholder="Email address"
                />
                <button
                  onClick={() => setShowChangeEmailDialog(true)}
                  className="flex items-center space-x-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
                >
                  <Edit className="w-4 h-4" />
                  <span className="font-semibold">Change</span>
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Click "Change" to update your email address</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-black mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={adminProfile.phoneNumber}
                onChange={(e) => setAdminProfile({ ...adminProfile, phoneNumber: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-black font-semibold placeholder-gray-400"
                placeholder="+639123456789"
              />
            </div>
          </div>
        </div>

        {/* GCash Payment Settings Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-black">💳 GCash Payment Settings</h2>
                <p className="text-sm text-gray-600">Drivers will send subscription payments to this GCash account</p>
              </div>
            </div>
            <button
              onClick={handleSaveGCashSettings}
              disabled={saving}
              className="flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-blue-700 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-blue-800 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span className="font-semibold">Update GCash Settings</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-black mb-2">
                GCash Account Name
              </label>
              <input
                type="text"
                value={paymentSettings.gcashName}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, gcashName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-black font-semibold placeholder-gray-400"
                placeholder="Name on GCash account"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-black mb-2">
                GCash Number
              </label>
              <input
                type="tel"
                value={paymentSettings.gcashNumber}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, gcashNumber: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-black font-semibold placeholder-gray-400"
                placeholder="09XXXXXXXXX"
                maxLength={11}
              />
              <p className="text-xs text-gray-500 mt-1">Format: 09XXXXXXXXX</p>
            </div>
          </div>

          {/* QR Code Section */}
          <div className="mt-6">
            <label className="block text-sm font-bold text-black mb-2">
              GCash QR Code (Optional)
            </label>
            <p className="text-xs text-gray-600 mb-4">Upload your GCash QR code so drivers can scan it to pay</p>

            {/* Current QR Code Preview */}
            {paymentSettings.gcashQrCodeUrl && !qrCodePreview && (
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-black mb-3">Current QR Code</p>
                <div className="flex items-center justify-center mb-3">
                  <img
                    src={paymentSettings.gcashQrCodeUrl}
                    alt="GCash QR Code"
                    className="w-40 h-40 object-contain bg-white rounded-lg"
                  />
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={handleRemoveQrCode}
                    disabled={saving}
                    className="flex items-center space-x-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition disabled:opacity-50 text-sm"
                  >
                    <X className="w-4 h-4" />
                    <span className="font-semibold">Remove QR Code</span>
                  </button>
                </div>
              </div>
            )}

            {/* New QR Code Preview */}
            {qrCodePreview && (
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-black mb-3">New QR Code Preview</p>
                <div className="flex items-center justify-center mb-3">
                  <img
                    src={qrCodePreview}
                    alt="QR Code Preview"
                    className="w-40 h-40 object-contain bg-white rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleUploadQrCode}
                    disabled={uploading}
                    className="flex items-center justify-center space-x-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    <span className="font-semibold">{uploading ? 'Uploading...' : 'Upload'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedQrCode(null);
                      setQrCodePreview(null);
                    }}
                    disabled={uploading}
                    className="flex items-center justify-center space-x-2 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    <span className="font-semibold">Cancel</span>
                  </button>
                </div>
              </div>
            )}

            {/* Upload Button */}
            {!qrCodePreview && (
              <div className="flex justify-center">
                <input
                  type="file"
                  id="qrCodeInput"
                  accept="image/*"
                  onChange={handleQrCodeSelect}
                  className="hidden"
                />
                <label
                  htmlFor="qrCodeInput"
                  className="inline-flex items-center space-x-2 bg-black text-white px-6 py-2.5 rounded-lg hover:bg-gray-800 transition cursor-pointer text-sm"
                >
                  <Upload className="w-4 h-4" />
                  <span className="font-semibold">Upload QR Code</span>
                </label>
              </div>
            )}

            {!paymentSettings.gcashQrCodeUrl && !qrCodePreview && (
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-6 text-center mt-4">
                <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm font-semibold text-black mb-2">No QR Code Uploaded</p>
                <p className="text-xs text-gray-600">
                  Click "Upload QR Code" above to add your GCash QR code
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Subscription Settings Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-black">💳 Subscription Settings</h2>
                <p className="text-sm text-gray-600">Configure driver subscription plans and pricing</p>
              </div>
            </div>
            <button
              onClick={handleSaveSubscriptionSettings}
              disabled={saving}
              className="flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 py-2 rounded-lg hover:from-amber-600 hover:to-orange-700 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span className="font-semibold">Save Settings</span>
            </button>
          </div>

          {/* Enable/Disable Toggle */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-black">Subscription System</h3>
                <p className="text-sm text-gray-600">
                  {subscriptionSettings.isEnabled ? 'Enabled - Drivers must subscribe to accept trips' : 'Disabled - Free access for all drivers'}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={subscriptionSettings.isEnabled}
                  onChange={(e) => setSubscriptionSettings({ ...subscriptionSettings, isEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1 Month Plan */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-bold text-black mb-4 flex items-center gap-2">
                <span className="text-lg">📅</span> 1 Month Plan
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-black mb-2">Price (PHP)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₱</span>
                    <input
                      type="number"
                      value={subscriptionSettings.oneMonthPrice}
                      onChange={(e) => setSubscriptionSettings({ ...subscriptionSettings, oneMonthPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none text-black font-semibold"
                      placeholder="150"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-2">Duration (Days)</label>
                  <input
                    type="number"
                    value={subscriptionSettings.oneMonthDays}
                    onChange={(e) => setSubscriptionSettings({ ...subscriptionSettings, oneMonthDays: parseInt(e.target.value) || 30 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none text-black font-semibold"
                    placeholder="30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-2">Plan Description</label>
                  <textarea
                    value={subscriptionSettings.oneMonthDescription || ''}
                    onChange={(e) => setSubscriptionSettings({ ...subscriptionSettings, oneMonthDescription: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none text-black font-semibold placeholder-gray-400"
                    rows={3}
                    placeholder="Short details for drivers"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-2">Plan Image</label>
                  {(subscriptionSettings.oneMonthImageUrl && !oneMonthImagePreview) || oneMonthImagePreview ? (
                    <div className="bg-gray-50 border border-gray-300 rounded-lg p-3">
                      <img
                        src={oneMonthImagePreview || subscriptionSettings.oneMonthImageUrl || ''}
                        alt="1 Month Plan"
                        className="w-full h-40 object-cover rounded-lg"
                      />
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        {oneMonthImagePreview ? (
                          <button
                            onClick={() => handleUploadPlanImage('one')}
                            disabled={uploadingPlanImage === 'one'}
                            className="flex items-center justify-center space-x-2 bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition disabled:opacity-50"
                          >
                            <Upload className="w-4 h-4" />
                            <span className="font-semibold">{uploadingPlanImage === 'one' ? 'Uploading...' : 'Upload'}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRemovePlanImage('one')}
                            className="flex items-center justify-center space-x-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
                          >
                            <X className="w-4 h-4" />
                            <span className="font-semibold">Remove</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedOneMonthImage(null);
                            setOneMonthImagePreview(null);
                          }}
                          className="flex items-center justify-center space-x-2 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition"
                        >
                          <X className="w-4 h-4" />
                          <span className="font-semibold">Cancel</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <input
                        type="file"
                        id="oneMonthImageInput"
                        accept="image/*"
                        onChange={(e) => handlePlanImageSelect('one', e)}
                        className="hidden"
                      />
                      <label
                        htmlFor="oneMonthImageInput"
                        className="inline-flex items-center space-x-2 bg-black text-white px-6 py-2.5 rounded-lg hover:bg-gray-800 transition cursor-pointer text-sm"
                      >
                        <Upload className="w-4 h-4" />
                        <span className="font-semibold">Upload Image</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3 Months Plan */}
            <div className="border-2 border-amber-400 rounded-lg p-4 bg-amber-50">
              <h3 className="font-bold text-black mb-4 flex items-center gap-2">
                <span className="text-lg">📅</span> 3 Months Plan
                <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded">RECOMMENDED</span>
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-black mb-2">Price (PHP)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₱</span>
                    <input
                      type="number"
                      value={subscriptionSettings.threeMonthsPrice}
                      onChange={(e) => setSubscriptionSettings({ ...subscriptionSettings, threeMonthsPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none text-black font-semibold"
                      placeholder="300"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-2">Duration (Days)</label>
                  <input
                    type="number"
                    value={subscriptionSettings.threeMonthsDays}
                    onChange={(e) => setSubscriptionSettings({ ...subscriptionSettings, threeMonthsDays: parseInt(e.target.value) || 90 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none text-black font-semibold"
                    placeholder="90"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-2">Plan Description</label>
                  <textarea
                    value={subscriptionSettings.threeMonthsDescription || ''}
                    onChange={(e) => setSubscriptionSettings({ ...subscriptionSettings, threeMonthsDescription: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none text-black font-semibold placeholder-gray-400"
                    rows={3}
                    placeholder="Short details for drivers"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-black mb-2">Plan Image</label>
                  {(subscriptionSettings.threeMonthsImageUrl && !threeMonthImagePreview) || threeMonthImagePreview ? (
                    <div className="bg-gray-50 border border-gray-300 rounded-lg p-3">
                      <img
                        src={threeMonthImagePreview || subscriptionSettings.threeMonthsImageUrl || ''}
                        alt="3 Months Plan"
                        className="w-full h-40 object-cover rounded-lg"
                      />
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        {threeMonthImagePreview ? (
                          <button
                            onClick={() => handleUploadPlanImage('three')}
                            disabled={uploadingPlanImage === 'three'}
                            className="flex items-center justify-center space-x-2 bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition disabled:opacity-50"
                          >
                            <Upload className="w-4 h-4" />
                            <span className="font-semibold">{uploadingPlanImage === 'three' ? 'Uploading...' : 'Upload'}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRemovePlanImage('three')}
                            className="flex items-center justify-center space-x-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
                          >
                            <X className="w-4 h-4" />
                            <span className="font-semibold">Remove</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedThreeMonthImage(null);
                            setThreeMonthImagePreview(null);
                          }}
                          className="flex items-center justify-center space-x-2 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition"
                        >
                          <X className="w-4 h-4" />
                          <span className="font-semibold">Cancel</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <input
                        type="file"
                        id="threeMonthImageInput"
                        accept="image/*"
                        onChange={(e) => handlePlanImageSelect('three', e)}
                        className="hidden"
                      />
                      <label
                        htmlFor="threeMonthImageInput"
                        className="inline-flex items-center space-x-2 bg-black text-white px-6 py-2.5 rounded-lg hover:bg-gray-800 transition cursor-pointer text-sm"
                      >
                        <Upload className="w-4 h-4" />
                        <span className="font-semibold">Upload Image</span>
                      </label>
                    </div>
                  )}
                </div>
                {calculateSavings() > 0 && (
                  <div className="bg-green-100 text-green-700 px-3 py-2 rounded-lg text-sm font-bold">
                    💰 Customer Savings: ₱{calculateSavings().toFixed(0)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Preview Section */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
            <h3 className="font-bold text-black mb-3">Preview - How drivers will see the plans:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded-lg border flex justify-between items-center">
                <div>
                  <p className="font-bold text-black">1 Month Plan</p>
                  <p className="text-sm text-gray-600">{subscriptionSettings.oneMonthDays} days</p>
                </div>
                <p className="text-xl font-bold text-amber-600">₱{subscriptionSettings.oneMonthPrice}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border-2 border-amber-400 flex justify-between items-center">
                <div>
                  <p className="font-bold text-black">3 Months Plan <span className="text-xs bg-amber-500 text-white px-1 rounded">BEST</span></p>
                  <p className="text-sm text-gray-600">{subscriptionSettings.threeMonthsDays} days</p>
                  {calculateSavings() > 0 && (
                    <p className="text-xs text-green-600 font-bold">Save ₱{calculateSavings().toFixed(0)}!</p>
                  )}
                </div>
                <p className="text-xl font-bold text-amber-600">₱{subscriptionSettings.threeMonthsPrice}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fare Settings */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Fare Settings</h2>
                <p className="text-sm text-gray-600">Configure trip pricing</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-black mb-2">
                  Base Fare (₱)
                </label>
                <input
                  type="number"
                  value={fareSettings.baseFare}
                  onChange={(e) => setFareSettings({ ...fareSettings, baseFare: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-black font-semibold"
                  placeholder="0.00"
                  step="0.01"
                />
                <p className="text-xs text-gray-600 mt-1">Initial charge when trip starts</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-black mb-2">
                  Per 2 Kilometers Rate (₱)
                </label>
                <input
                  type="number"
                  value={fareSettings.per2KmRate}
                  onChange={(e) => setFareSettings({ ...fareSettings, per2KmRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-black font-semibold"
                  placeholder="0.00"
                  step="0.01"
                />
                <p className="text-xs text-gray-600 mt-1">Charge for every 2 kilometers traveled</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-black mb-2">
                  Per Passenger Rate (₱)
                </label>
                <input
                  type="number"
                  value={fareSettings.perPassengerRate}
                  onChange={(e) => setFareSettings({ ...fareSettings, perPassengerRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-black font-semibold"
                  placeholder="0.00"
                  step="0.01"
                />
                <p className="text-xs text-gray-600 mt-1">Charge for each passenger (especially for tricycles)</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-black mb-2">
                  Minimum Fare (₱)
                </label>
                <input
                  type="number"
                  value={fareSettings.minimumFare}
                  onChange={(e) => setFareSettings({ ...fareSettings, minimumFare: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-black font-semibold"
                  placeholder="0.00"
                  step="0.01"
                />
                <p className="text-xs text-gray-600 mt-1">Minimum charge for any trip</p>
              </div>

              <div className="pt-4 border-t">
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="font-bold text-black mb-3 flex items-center gap-2">
                    <span>📐</span> Fare Calculation Formula
                  </h3>
                  <div className="bg-white rounded-lg p-3 mb-3">
                    <code className="text-xs text-black font-mono">
                      Total = Base + (Distance ÷ 2 × Rate/2km) + (Passengers × Rate/passenger)
                    </code>
                  </div>
                  <p className="text-xs text-gray-600 mb-3 italic">If calculated fare &lt; Minimum Fare, then use Minimum Fare</p>
                  
                  <h4 className="font-bold text-black mb-2">Example Calculation</h4>
                  <p className="text-sm text-gray-700 font-semibold mb-2">
                    5 km trip with 3 passengers:
                  </p>
                  <p className="text-2xl font-bold text-blue-600 mt-2 mb-2">
                    ₱{(() => {
                      const baseFare = fareSettings.baseFare || 0;
                      const distanceCost = (5 / 2) * (fareSettings.per2KmRate || 0);
                      const passengerCost = 3 * (fareSettings.perPassengerRate || 0);
                      const calculatedFare = baseFare + distanceCost + passengerCost;
                      const finalFare = calculatedFare < (fareSettings.minimumFare || 0) ? (fareSettings.minimumFare || 0) : calculatedFare;
                      return finalFare.toFixed(2);
                    })()}
                  </p>
                  <div className="text-xs text-gray-700 space-y-1 font-medium">
                    <p>Base Fare: ₱{(fareSettings.baseFare || 0).toFixed(2)}</p>
                    <p>Distance: (5km ÷ 2) × ₱{(fareSettings.per2KmRate || 0).toFixed(2)} = ₱{((5 / 2) * (fareSettings.per2KmRate || 0)).toFixed(2)}</p>
                    <p>Passengers: 3 × ₱{(fareSettings.perPassengerRate || 0).toFixed(2)} = ₱{(3 * (fareSettings.perPassengerRate || 0)).toFixed(2)}</p>
                    <p className="text-green-600 font-bold pt-1 border-t">
                      Total: ₱{(() => {
                        const calculatedFare = (fareSettings.baseFare || 0) + ((5 / 2) * (fareSettings.per2KmRate || 0)) + (3 * (fareSettings.perPassengerRate || 0));
                        return calculatedFare.toFixed(2);
                      })()} {(() => {
                        const calculatedFare = (fareSettings.baseFare || 0) + ((5 / 2) * (fareSettings.per2KmRate || 0)) + (3 * (fareSettings.perPassengerRate || 0));
                        return calculatedFare < (fareSettings.minimumFare || 0) ? `(< minimum ₱${(fareSettings.minimumFare || 0).toFixed(2)})` : '';
                      })()}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleSaveFareSettings}
                  disabled={saving}
                  className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  <Save className="w-5 h-5" />
                  <span>{saving ? 'Saving...' : 'Save Fare Settings'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Support Settings (matches Flutter app) */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Headphones className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Support Settings</h2>
                <p className="text-sm text-gray-600">Help & Support contact info for passengers and drivers</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-bold text-black mb-2">
                  Support Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    value={supportSettings.email}
                    onChange={(e) => setSupportSettings({ ...supportSettings, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-black font-semibold"
                    placeholder="support@pasakay.com"
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1">Email for customer support</p>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-bold text-black mb-2">
                  Support Phone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="tel"
                    value={supportSettings.phone}
                    onChange={(e) => setSupportSettings({ ...supportSettings, phone: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-black font-semibold"
                    placeholder="+63 912 345 6789"
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1">Phone number with country code</p>
              </div>

              {/* Facebook Name */}
              <div>
                <label className="block text-sm font-bold text-black mb-2">
                  Facebook Page Name
                </label>
                <div className="relative">
                  <Facebook className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={supportSettings.facebookName}
                    onChange={(e) => setSupportSettings({ ...supportSettings, facebookName: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-black font-semibold"
                    placeholder="Pasakay Official"
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1">Display name for your Facebook page</p>
              </div>

              {/* Facebook URL */}
              <div>
                <label className="block text-sm font-bold text-black mb-2">
                  Facebook Page URL
                </label>
                <div className="relative">
                  <Facebook className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="url"
                    value={supportSettings.facebookUrl}
                    onChange={(e) => setSupportSettings({ ...supportSettings, facebookUrl: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-black font-semibold"
                    placeholder="https://facebook.com/pasakay"
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1">Full URL to your Facebook page</p>
              </div>

              {/* Support Hours */}
              <div>
                <label className="block text-sm font-bold text-black mb-2">
                  Support Hours
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                  <textarea
                    value={supportSettings.supportHours}
                    onChange={(e) => setSupportSettings({ ...supportSettings, supportHours: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-black font-semibold resize-none"
                    placeholder="Monday - Sunday&#10;8:00 AM - 8:00 PM"
                    rows={3}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1">Operating hours for customer support</p>
              </div>

              <div className="pt-4 border-t">
                <div className="bg-cyan-50 rounded-lg p-4 mb-4">
                  <h3 className="font-bold text-black mb-2">Preview</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-blue-600" />
                      <span className="text-black font-semibold">Email:</span>
                      <span className="font-semibold text-gray-700">{supportSettings.email || 'Not set'}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4 text-green-600" />
                      <span className="text-black font-semibold">Phone:</span>
                      <span className="font-semibold text-gray-700">{supportSettings.phone || 'Not set'}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Facebook className="w-4 h-4 text-blue-600" />
                      <span className="text-black font-semibold">Facebook:</span>
                      <span className="font-semibold text-gray-700">{supportSettings.facebookName || 'Not set'}</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <Clock className="w-4 h-4 text-orange-600 mt-0.5" />
                      <span className="text-black font-semibold">Hours:</span>
                      <span className="font-semibold text-gray-700 whitespace-pre-line">{supportSettings.supportHours || 'Not set'}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSaveSupportSettings}
                  disabled={saving}
                  className="w-full px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg font-semibold hover:from-cyan-700 hover:to-blue-700 disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  <Save className="w-5 h-5" />
                  <span>{saving ? 'Saving...' : 'Save Support Settings'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SMTP Settings */}
        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-slate-600 to-slate-800 rounded-lg flex items-center justify-center">
              <Server className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">SMTP Settings</h2>
              <p className="text-sm text-gray-600">Used for admin OTP email verification</p>
            </div>
          </div>

          {smtpLoading ? (
            <div className="text-sm text-gray-600">Loading SMTP settings...</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    SMTP Host
                  </label>
                  <div className="relative">
                    <Server className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      value={smtpSettings.host}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-black font-semibold"
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    SMTP Port
                  </label>
                  <input
                    type="number"
                    value={smtpSettings.port}
                    onChange={(e) => setSmtpSettings({ ...smtpSettings, port: Number(e.target.value || 0) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-black font-semibold"
                    placeholder="587"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    SMTP Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      value={smtpSettings.user}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, user: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-black font-semibold"
                      placeholder="your@email.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    SMTP Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type={showSmtpPassword ? 'text' : 'password'}
                      value={smtpSettings.pass}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, pass: e.target.value })}
                      className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-black font-semibold"
                      placeholder={smtpSettings.hasPass ? 'Saved (leave blank to keep)' : 'Enter password'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showSmtpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    From Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="email"
                      value={smtpSettings.fromEmail}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, fromEmail: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-black font-semibold"
                      placeholder="no-reply@pasakay.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    From Name
                  </label>
                  <input
                    type="text"
                    value={smtpSettings.fromName}
                    onChange={(e) => setSmtpSettings({ ...smtpSettings, fromName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-black font-semibold"
                    placeholder="Pasakay Admin"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  id="smtpSecure"
                  type="checkbox"
                  checked={smtpSettings.secure}
                  onChange={(e) => setSmtpSettings({ ...smtpSettings, secure: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="smtpSecure" className="text-sm text-gray-700 font-semibold">
                  Use SSL/TLS (port 465)
                </label>
              </div>

              <div className="pt-4 border-t space-y-3">
                <div className="flex flex-col md:flex-row gap-3">
                  <input
                    type="email"
                    value={smtpTestEmail}
                    onChange={(e) => setSmtpTestEmail(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-black font-semibold"
                    placeholder="Test email address"
                  />
                  <button
                    onClick={handleSendTestEmail}
                    disabled={smtpTestSending}
                    className="px-4 py-2 bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    {smtpTestSending ? 'Sending...' : 'Send Test'}
                  </button>
                </div>

                <button
                  onClick={handleSaveSmtpSettings}
                  disabled={smtpSaving}
                  className="w-full px-4 py-3 bg-gradient-to-r from-slate-700 to-slate-900 text-white rounded-lg font-semibold hover:from-slate-800 hover:to-black disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  <Save className="w-5 h-5" />
                  <span>{smtpSaving ? 'Saving...' : 'Save SMTP Settings'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-bold text-black mb-2">ℹ️ Important Notes</h3>
          <ul className="text-sm text-black space-y-1 list-disc list-inside font-medium">
            <li>Fare changes will apply to all new trips immediately</li>
            <li>Ongoing trips will use the fare settings from when they started</li>
            <li>Contact information is displayed in the mobile app</li>
            <li>Make sure to test fare calculations before saving</li>
          </ul>
        </div>

        {/* Change Email Dialog */}
        {showChangeEmailDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-black mb-4">Change Email Address</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={changeEmailData.currentPassword}
                    onChange={(e) => setChangeEmailData({ ...changeEmailData, currentPassword: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-black font-semibold"
                    placeholder="Enter your current password"
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    New Email Address
                  </label>
                  <input
                    type="email"
                    value={changeEmailData.newEmail}
                    onChange={(e) => setChangeEmailData({ ...changeEmailData, newEmail: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-black font-semibold"
                    placeholder="Enter new email address"
                    disabled={saving}
                  />
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-xs text-black font-medium">
                    ℹ️ Note: You'll need to verify your new email address after changing it.
                  </p>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={handleChangeEmail}
                  disabled={saving}
                  className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition disabled:opacity-50 font-semibold"
                >
                  {saving ? 'Changing...' : 'Change Email'}
                </button>
                <button
                  onClick={() => {
                    setShowChangeEmailDialog(false);
                    setChangeEmailData({ currentPassword: '', newEmail: '' });
                  }}
                  disabled={saving}
                  className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition disabled:opacity-50 font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
