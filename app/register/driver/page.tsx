'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, CheckCircle, AlertCircle, Camera, Eye, EyeOff, X } from 'lucide-react';
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

type FaceMatchStatus = 'pending' | 'checking' | 'passed' | 'review' | 'failed';
type OrCrOcrStatus = 'pending' | 'checking' | 'matched' | 'review' | 'mismatch';

type OrCrExtractedFields = {
  plateCandidates: string[];
  vehicleModelMatched: boolean;
  vehicleNumberMatched: boolean;
};

let faceApiLoadPromise: Promise<any> | null = null;

const loadFaceApiModels = async () => {
  if (typeof window === 'undefined') {
    throw new Error('Face matching only runs in the browser');
  }

  if (!faceApiLoadPromise) {
    faceApiLoadPromise = import('@vladmandic/face-api').then(async (module) => {
      const faceapi = (module as any).default || module;
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
      ]);
      return faceapi;
    });
  }

  return faceApiLoadPromise;
};

const loadImageFromFile = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Unable to read ${file.name}`));
    };
    image.src = url;
  });

const calculateFaceMatchScore = (distance: number) => {
  const value = Math.max(0, Math.min(1, distance));
  if (value <= 0.35) return Math.round(88 + ((0.35 - value) / 0.35) * 12);
  if (value <= 0.45) return Math.round(70 + ((0.45 - value) / 0.1) * 18);
  if (value <= 0.6) return Math.round(45 + ((0.6 - value) / 0.15) * 25);
  if (value <= 0.8) return Math.round(((0.8 - value) / 0.2) * 44);
  return 0;
};

const getFaceMatchStatusFromScore = (score: number): FaceMatchStatus => {
  if (score >= 70) return 'passed';
  if (score >= 45) return 'review';
  return 'failed';
};

const normalizeOcrText = (text: string) =>
  text
    .toUpperCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeLookupValue = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const extractPlateCandidates = (text: string) => {
  const matches = text.match(/\b[A-Z]{2,3}[-\s]?\d{3,4}\b|\b\d{3}[-\s]?[A-Z]{2,3}\b|\b[A-Z0-9]{6,12}\b/g) || [];
  return Array.from(new Set(matches.map((match) => normalizeLookupValue(match)).filter((match) => match.length >= 5)));
};

const analyzeOrCrText = (
  text: string,
  values: { vehicleLicense: string; vehicleModel: string; vehicleNumber: string }
) => {
  const normalizedText = normalizeOcrText(text);
  const compactText = normalizeLookupValue(normalizedText);
  const plateValue = normalizeLookupValue(values.vehicleLicense);
  const modelValue = normalizeLookupValue(values.vehicleModel);
  const numberValue = normalizeLookupValue(values.vehicleNumber);
  const plateCandidates = extractPlateCandidates(normalizedText);
  const plateMatched = Boolean(plateValue && compactText.includes(plateValue));
  const vehicleModelMatched = Boolean(modelValue && compactText.includes(modelValue));
  const vehicleNumberMatched = Boolean(numberValue && compactText.includes(numberValue));
  const matchedCount = [plateMatched, vehicleModelMatched, vehicleNumberMatched].filter(Boolean).length;
  const status: OrCrOcrStatus = !normalizedText
    ? 'review'
    : plateMatched || matchedCount >= 2
      ? 'matched'
      : matchedCount === 1 || plateCandidates.length > 0
        ? 'review'
        : 'mismatch';
  const message = status === 'matched'
    ? 'OR/CR text appears to match the vehicle details.'
    : status === 'review'
      ? 'OR/CR text needs admin review. Some vehicle details could not be confirmed.'
      : 'OR/CR text did not match the typed vehicle details.';

  return {
    text,
    normalizedText,
    extractedFields: {
      plateCandidates,
      vehicleModelMatched,
      vehicleNumberMatched,
    } as OrCrExtractedFields,
    plateMatched,
    status,
    message,
  };
};

type OrCrOcrResult = ReturnType<typeof analyzeOrCrText>;

export default function DriverRegistrationPage() {
  const router = useRouter();
  const pageRef = useRef<HTMLDivElement | null>(null);
  const selfieVideoRef = useRef<HTMLVideoElement | null>(null);
  const selfieStreamRef = useRef<MediaStream | null>(null);
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
  const [driverLicenseFrontFile, setDriverLicenseFrontFile] = useState<File | null>(null);
  const [driverLicenseFrontPreview, setDriverLicenseFrontPreview] = useState<string | null>(null);
  const [driverLicenseBackFile, setDriverLicenseBackFile] = useState<File | null>(null);
  const [driverLicenseBackPreview, setDriverLicenseBackPreview] = useState<string | null>(null);
  const [orCrFile, setOrCrFile] = useState<File | null>(null);
  const [orCrPreview, setOrCrPreview] = useState<string | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [faceMatchScore, setFaceMatchScore] = useState<number | null>(null);
  const [faceMatchStatus, setFaceMatchStatus] = useState<FaceMatchStatus>('pending');
  const [faceMatchMessage, setFaceMatchMessage] = useState('');
  const [faceMatchLoading, setFaceMatchLoading] = useState(false);
  const [orCrOcrText, setOrCrOcrText] = useState('');
  const [orCrOcrStatus, setOrCrOcrStatus] = useState<OrCrOcrStatus>('pending');
  const [orCrOcrMessage, setOrCrOcrMessage] = useState('');
  const [orCrOcrFields, setOrCrOcrFields] = useState<OrCrExtractedFields | null>(null);
  const [orCrOcrLoading, setOrCrOcrLoading] = useState(false);
  const [orCrOcrProgress, setOrCrOcrProgress] = useState(0);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'licenseFront' | 'licenseBack' | 'orcr'
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (type === 'licenseFront') {
        setFaceMatchScore(null);
        setFaceMatchStatus('pending');
        setFaceMatchMessage('');
      } else if (type === 'orcr') {
        setOrCrOcrText('');
        setOrCrOcrStatus('pending');
        setOrCrOcrMessage('');
        setOrCrOcrFields(null);
        setOrCrOcrProgress(0);
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'licenseFront') {
          setDriverLicenseFrontFile(file);
          setDriverLicenseFrontPreview(reader.result as string);
          if (selfieFile) {
            void checkFaceMatch(file, selfieFile);
          }
        } else if (type === 'licenseBack') {
          setDriverLicenseBackFile(file);
          setDriverLicenseBackPreview(reader.result as string);
        } else {
          setOrCrFile(file);
          setOrCrPreview(reader.result as string);
          void runOrCrOcr(file);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const stopSelfieCamera = (updateState = true) => {
    selfieStreamRef.current?.getTracks().forEach((track) => track.stop());
    selfieStreamRef.current = null;
    if (selfieVideoRef.current) {
      selfieVideoRef.current.srcObject = null;
    }
    if (updateState) {
      setCameraOpen(false);
      setCameraReady(false);
      setCameraStarting(false);
    }
  };

  const closeSelfieCamera = () => {
    stopSelfieCamera();
  };

  const runOrCrOcr = async (file = orCrFile) => {
    if (!file) return null;

    setOrCrOcrLoading(true);
    setOrCrOcrStatus('checking');
    setOrCrOcrMessage('Reading OR/CR document...');
    setOrCrOcrProgress(0);

    try {
      const { createWorker, PSM } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, {
        logger: (event: any) => {
          if (event.status === 'recognizing text' && typeof event.progress === 'number') {
            setOrCrOcrProgress(Math.round(event.progress * 100));
          }
        },
      });

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      });

      const { data } = await worker.recognize(file);
      await worker.terminate();

      const result = analyzeOrCrText(data.text || '', {
        vehicleLicense: formData.vehicleLicense,
        vehicleModel: formData.vehicleModel,
        vehicleNumber: formData.vehicleNumber,
      });

      setOrCrOcrText(result.text);
      setOrCrOcrStatus(result.status);
      setOrCrOcrMessage(result.message);
      setOrCrOcrFields(result.extractedFields);
      setOrCrOcrProgress(100);
      return result;
    } catch (error) {
      console.error('OR/CR OCR error:', error);
      setOrCrOcrStatus('review');
      setOrCrOcrMessage('OR/CR OCR could not run on this device. Admin must review manually.');
      return null;
    } finally {
      setOrCrOcrLoading(false);
    }
  };

  const startSelfieCamera = async () => {
    setCameraError('');
    setCameraReady(false);
    setCameraStarting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera is not available in this browser.');
      }

      stopSelfieCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      selfieStreamRef.current = stream;
      setCameraOpen(true);
    } catch (error: any) {
      console.error('Camera error:', error);
      setCameraError(error?.message || 'Unable to open camera. Please allow camera permission and try again.');
      stopSelfieCamera();
    }
  };

  const captureSelfie = () => {
    const video = selfieVideoRef.current;
    if (!cameraReady || !video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      setCameraError('Camera is still starting. Please try again in a moment.');
      return;
    }

    const size = Math.min(video.videoWidth || 720, video.videoHeight || 720);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) {
      setCameraError('Unable to capture selfie from camera.');
      return;
    }

    const sourceX = Math.max(0, ((video.videoWidth || size) - size) / 2);
    const sourceY = Math.max(0, ((video.videoHeight || size) - size) / 2);
    context.save();
    context.translate(size, 0);
    context.scale(-1, 1);
    context.drawImage(video, sourceX, sourceY, size, size, 0, 0, size, size);
    context.restore();

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError('Unable to save captured selfie.');
          return;
        }
        const file = new File([blob], 'driver-selfie.jpg', { type: 'image/jpeg' });
        setSelfieFile(file);
        setSelfiePreview(URL.createObjectURL(blob));
        setCameraError('');
        void checkFaceMatch(driverLicenseFrontFile, file);
        stopSelfieCamera();
      },
      'image/jpeg',
      0.92
    );
  };

  const checkFaceMatch = async (licenseFile = driverLicenseFrontFile, capturedSelfieFile = selfieFile) => {
    if (!licenseFile || !capturedSelfieFile) {
      setFaceMatchScore(null);
      setFaceMatchStatus('pending');
      setFaceMatchMessage('Upload the license front image and capture a selfie to get a match result.');
      return null;
    }

    setFaceMatchLoading(true);
    setFaceMatchStatus('checking');
    setFaceMatchMessage('Checking face match...');

    try {
      const faceapi = await loadFaceApiModels();
      const [licenseImage, selfieImage] = await Promise.all([
        loadImageFromFile(licenseFile),
        loadImageFromFile(capturedSelfieFile),
      ]);
      const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: 416,
        scoreThreshold: 0.35,
      });

      const licenseFace = await faceapi
        .detectSingleFace(licenseImage, options)
        .withFaceLandmarks(true)
        .withFaceDescriptor();
      const selfieFace = await faceapi
        .detectSingleFace(selfieImage, options)
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      if (!licenseFace || !selfieFace) {
        setFaceMatchScore(null);
        setFaceMatchStatus('review');
        setFaceMatchMessage(
          !licenseFace && !selfieFace
            ? 'Could not detect a face in the license and selfie. Admin must review manually.'
            : !licenseFace
              ? 'Could not detect a face in the license photo. Admin must review manually.'
              : 'Could not detect a face in the selfie. Please retake or let admin review manually.'
        );
        return null;
      }

      const distance = faceapi.euclideanDistance(licenseFace.descriptor, selfieFace.descriptor);
      const score = calculateFaceMatchScore(distance);
      const status = getFaceMatchStatusFromScore(score);
      setFaceMatchScore(score);
      setFaceMatchStatus(status);
      setFaceMatchMessage(
        status === 'passed'
          ? `Face match passed at ${score}%.`
          : status === 'review'
            ? `Face match is ${score}%. Admin should review this manually.`
            : `Face match is only ${score}%. Please check the documents carefully.`
      );
      return { score, status };
    } catch (error) {
      console.error('Face match error:', error);
      setFaceMatchScore(null);
      setFaceMatchStatus('review');
      setFaceMatchMessage('Face match could not run on this device. Admin must review manually.');
      return null;
    } finally {
      setFaceMatchLoading(false);
    }
  };

  useEffect(() => {
    if (!cameraOpen || !selfieVideoRef.current || !selfieStreamRef.current) return;

    const video = selfieVideoRef.current;
    video.srcObject = selfieStreamRef.current;

    const markReady = () => {
      setCameraReady(true);
      setCameraStarting(false);
      setCameraError('');
    };

    video.addEventListener('loadedmetadata', markReady);
    video.addEventListener('canplay', markReady);
    video.play().catch((error) => {
      console.error('Unable to play selfie camera stream:', error);
      setCameraError('Tap Open Camera again or allow camera permission in your browser.');
      setCameraStarting(false);
    });

    if (video.readyState >= 2 && video.videoWidth > 0) {
      markReady();
    }

    return () => {
      video.removeEventListener('loadedmetadata', markReady);
      video.removeEventListener('canplay', markReady);
    };
  }, [cameraOpen]);

  useEffect(() => {
    return () => {
      stopSelfieCamera(false);
      if (selfiePreview?.startsWith('blob:')) {
        URL.revokeObjectURL(selfiePreview);
      }
    };
  }, [selfiePreview]);

  useEffect(() => {
    if (!orCrOcrText || orCrOcrLoading) return;

    const result = analyzeOrCrText(orCrOcrText, {
      vehicleLicense: formData.vehicleLicense,
      vehicleModel: formData.vehicleModel,
      vehicleNumber: formData.vehicleNumber,
    });
    setOrCrOcrStatus(result.status);
    setOrCrOcrMessage(result.message);
    setOrCrOcrFields(result.extractedFields);
  }, [formData.vehicleLicense, formData.vehicleModel, formData.vehicleNumber, orCrOcrText, orCrOcrLoading]);

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

    const selectedDriverLicenseFrontFile = driverLicenseFrontFile;
    if (!selectedDriverLicenseFrontFile) {
      setError('Driver\'s license front image is required');
      return;
    }

    const licenseFrontFileError = validateImageFile(selectedDriverLicenseFrontFile, 'Driver\'s license front image');
    if (licenseFrontFileError) {
      setError(licenseFrontFileError);
      return;
    }

    const selectedDriverLicenseBackFile = driverLicenseBackFile;
    if (!selectedDriverLicenseBackFile) {
      setError('Driver\'s license back image is required');
      return;
    }

    const licenseBackFileError = validateImageFile(selectedDriverLicenseBackFile, 'Driver\'s license back image');
    if (licenseBackFileError) {
      setError(licenseBackFileError);
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

    const selectedSelfieFile = selfieFile;
    if (!selectedSelfieFile) {
      setError('Selfie verification photo is required');
      return;
    }

    const selfieFileError = validateImageFile(selectedSelfieFile, 'Selfie verification photo');
    if (selfieFileError) {
      setError(selfieFileError);
      return;
    }

    if (!agreeToTerms) {
      setError('Please agree to the Terms of Service');
      return;
    }

    let finalFaceMatchScore = faceMatchScore;
    let finalFaceMatchStatus = faceMatchStatus;
    let finalFaceMatchMessage = faceMatchMessage;
    if (finalFaceMatchStatus === 'pending' || finalFaceMatchStatus === 'checking') {
      const matchResult = await checkFaceMatch(selectedDriverLicenseFrontFile, selectedSelfieFile);
      finalFaceMatchScore = matchResult?.score ?? null;
      finalFaceMatchStatus = matchResult?.status ?? 'review';
      finalFaceMatchMessage = matchResult
        ? matchResult.status === 'passed'
          ? `Face match passed at ${matchResult.score}%.`
          : matchResult.status === 'review'
            ? `Face match is ${matchResult.score}%. Admin should review this manually.`
            : `Face match is only ${matchResult.score}%. Please check the documents carefully.`
        : faceMatchMessage || 'Face match could not be confirmed. Admin must review manually.';
    }

    let finalOrCrOcrText = orCrOcrText;
    let finalOrCrOcrStatus = orCrOcrStatus;
    let finalOrCrOcrMessage = orCrOcrMessage;
    let finalOrCrOcrFields = orCrOcrFields;
    if (!finalOrCrOcrText && !orCrOcrLoading) {
      const ocrResult = await runOrCrOcr(selectedOrCrFile);
      finalOrCrOcrText = ocrResult?.text || '';
      finalOrCrOcrStatus = ocrResult?.status || 'review';
      finalOrCrOcrMessage = ocrResult?.message || 'OR/CR OCR could not be confirmed. Admin must review manually.';
      finalOrCrOcrFields = ocrResult?.extractedFields || null;
    } else if (finalOrCrOcrText) {
      const ocrResult = analyzeOrCrText(finalOrCrOcrText, {
        vehicleLicense,
        vehicleModel,
        vehicleNumber,
      });
      finalOrCrOcrStatus = ocrResult.status;
      finalOrCrOcrMessage = ocrResult.message;
      finalOrCrOcrFields = ocrResult.extractedFields;
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
      console.log('Uploading driver license front to Cloudinary...');
      const licenseFrontUrl = await uploadToCloudinary(selectedDriverLicenseFrontFile, `pasakay/drivers/${user.uid}`);
      console.log('License front uploaded:', licenseFrontUrl);

      console.log('Uploading driver license back to Cloudinary...');
      const licenseBackUrl = await uploadToCloudinary(selectedDriverLicenseBackFile, `pasakay/drivers/${user.uid}`);
      console.log('License back uploaded:', licenseBackUrl);

      console.log('Uploading OR/CR to Cloudinary...');
      const orCrUrl = await uploadToCloudinary(selectedOrCrFile, `pasakay/drivers/${user.uid}`);
      console.log('OR/CR uploaded:', orCrUrl);

      console.log('Uploading selfie verification photo to Cloudinary...');
      const selfieUrl = await uploadToCloudinary(selectedSelfieFile, `pasakay/drivers/${user.uid}`);
      console.log('Selfie uploaded:', selfieUrl);

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
        driversLicenseUrl: licenseFrontUrl,
        driverLicenseUrl: licenseFrontUrl,
        driversLicenseFrontUrl: licenseFrontUrl,
        driversLicenseBackUrl: licenseBackUrl,
        orCrUrl: orCrUrl,
        orCrOcrText: finalOrCrOcrText,
        orCrOcrStatus: finalOrCrOcrStatus,
        orCrOcrMessage: finalOrCrOcrMessage,
        orCrExtractedFields: finalOrCrOcrFields,
        orCrOcrCheckedAt: finalOrCrOcrStatus === 'pending' || finalOrCrOcrStatus === 'checking' ? null : now,
        driverSelfieUrl: selfieUrl,
        faceMatchScore: finalFaceMatchScore,
        faceMatchStatus: finalFaceMatchStatus,
        faceMatchMessage: finalFaceMatchMessage,
        faceVerifiedAt: finalFaceMatchStatus === 'pending' || finalFaceMatchStatus === 'checking' ? null : now,
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
          message: `${name} has registered as a driver and needs verification. Face match: ${finalFaceMatchScore === null ? 'manual review' : `${finalFaceMatchScore}%`}.`,
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
      {cameraOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/65 px-3 py-6 sm:py-10">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#e5e2d8] px-5 py-4">
              <div>
                <h2 className="text-2xl font-bold text-[#18211f]">Face verification</h2>
                <p className="mt-1 text-sm text-[#66736f]">Center your face inside the oval.</p>
              </div>
              <button
                type="button"
                onClick={closeSelfieCamera}
                className="rounded-full p-2 text-[#66736f] transition-colors hover:bg-[#f5f4ef] hover:text-[#18211f]"
                aria-label="Close face verification"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl border border-[#d9d4c6] bg-[#18211f] shadow-sm">
                <video
                  ref={selfieVideoRef}
                  className="h-full w-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                  autoPlay
                  playsInline
                  muted
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-[66%] w-[58%] rounded-[50%] border-[4px] border-white/95 shadow-[0_0_0_9999px_rgba(0,0,0,0.12)]" />
                </div>
                <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-4 py-2 text-xs font-bold text-white">
                  Align your face inside the oval
                </div>
              </div>

              {cameraError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {cameraError}
                </p>
              ) : (
                <p className="text-center text-sm font-semibold text-[#66736f]">
                  {cameraReady ? 'Camera ready. Center your face inside the oval.' : 'Starting camera...'}
                </p>
              )}

              <button
                type="button"
                onClick={closeSelfieCamera}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#d9d4c6] bg-white px-4 py-3 text-sm font-bold text-[#18211f] hover:bg-[#faf9f5]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                onClick={captureSelfie}
                disabled={!cameraReady || cameraStarting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1f6f68] px-4 py-3 text-sm font-bold text-white hover:bg-[#174c49] disabled:cursor-not-allowed disabled:bg-[#c9c7ce] disabled:text-[#74717a]"
              >
                <Camera className="h-4 w-4" />
                {cameraReady ? 'Capture Selfie' : 'Starting...'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                {/* Driver's License Front */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#49534f] mb-2">
                    Driver&apos;s License Front <span className="text-[#b42318]">*</span>
                  </label>
                  <div className="border border-dashed border-[#cfc9bb] rounded-xl bg-white p-5 text-center transition-all duration-300 hover:border-[#1f6f68] hover:bg-[#1f6f68]/5 cursor-pointer shadow-sm">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, 'licenseFront')}
                      className="hidden"
                      id="license-front-upload"
                    />
                    <label htmlFor="license-front-upload" className="cursor-pointer block w-full">
                      {driverLicenseFrontPreview ? (
                        <div className="w-full">
                          <img
                            src={driverLicenseFrontPreview}
                            alt="License front preview"
                            className="w-full h-36 object-cover rounded-lg mb-3 shadow-sm border border-[#e5e2d8]"
                          />
                          <p className="text-xs font-bold text-emerald-700 flex items-center justify-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Checked (Click to Replace)
                          </p>
                        </div>
                      ) : (
                        <div className="py-4">
                          <Upload className="w-8 h-8 text-[#66736f] mx-auto mb-2" />
                          <p className="text-xs font-bold text-[#18211f]">Click to upload License Front</p>
                          <p className="text-[10px] text-[#66736f] mt-1">PNG, JPG up to 10MB</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Driver's License Back */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#49534f] mb-2">
                    Driver&apos;s License Back <span className="text-[#b42318]">*</span>
                  </label>
                  <div className="border border-dashed border-[#cfc9bb] rounded-xl bg-white p-5 text-center transition-all duration-300 hover:border-[#1f6f68] hover:bg-[#1f6f68]/5 cursor-pointer shadow-sm">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, 'licenseBack')}
                      className="hidden"
                      id="license-back-upload"
                    />
                    <label htmlFor="license-back-upload" className="cursor-pointer block w-full">
                      {driverLicenseBackPreview ? (
                        <div className="w-full">
                          <img
                            src={driverLicenseBackPreview}
                            alt="License back preview"
                            className="w-full h-36 object-cover rounded-lg mb-3 shadow-sm border border-[#e5e2d8]"
                          />
                          <p className="text-xs font-bold text-emerald-700 flex items-center justify-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Checked (Click to Replace)
                          </p>
                          <p className="mt-2 text-[10px] font-semibold text-[#66736f]">
                            {orCrOcrLoading ? `Reading OR/CR text... ${orCrOcrProgress}%` : 'OR/CR uploaded'}
                          </p>
                        </div>
                      ) : (
                        <div className="py-4">
                          <Upload className="w-8 h-8 text-[#66736f] mx-auto mb-2" />
                          <p className="text-xs font-bold text-[#18211f]">Click to upload License Back</p>
                          <p className="text-[10px] text-[#66736f] mt-1">PNG, JPG up to 10MB</p>
                        </div>
                      )}
                    </label>
                  </div>
                  {(orCrOcrLoading || orCrOcrMessage || orCrOcrText) && (
                    <div
                      className={`mt-3 rounded-lg border px-3 py-2 text-left text-xs ${
                        orCrOcrStatus === 'matched'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : orCrOcrStatus === 'mismatch'
                            ? 'border-red-200 bg-red-50 text-red-700'
                            : 'border-amber-200 bg-amber-50 text-amber-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-bold">OR/CR OCR</span>
                        <span className="font-black">
                          {orCrOcrLoading || orCrOcrStatus === 'checking'
                            ? `${orCrOcrProgress}%`
                            : orCrOcrStatus === 'matched'
                              ? 'Matched'
                              : orCrOcrStatus === 'mismatch'
                                ? 'Mismatch'
                                : 'Review'}
                        </span>
                      </div>
                      {orCrOcrMessage && (
                        <p className="mt-1 leading-relaxed">{orCrOcrMessage}</p>
                      )}
                      {orCrOcrFields?.plateCandidates?.length ? (
                        <p className="mt-1 text-[10px]">
                          Detected possible plate/MV: {orCrOcrFields.plateCandidates.slice(0, 3).join(', ')}
                        </p>
                      ) : null}
                    </div>
                  )}
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

                {/* Selfie verification */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#49534f] mb-2">
                    Selfie Verification Photo <span className="text-[#b42318]">*</span>
                  </label>
                  <div className="border border-dashed border-[#cfc9bb] rounded-xl bg-white p-5 text-center shadow-sm">
                    {selfiePreview ? (
                      <div className="w-full">
                        <img
                          src={selfiePreview}
                          alt="Selfie verification preview"
                          className="mx-auto h-48 w-48 rounded-xl border border-[#e5e2d8] object-cover shadow-sm"
                        />
                        <p className="mt-3 text-xs font-bold text-emerald-700 flex items-center justify-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Captured
                        </p>
                        <button
                          type="button"
                          onClick={startSelfieCamera}
                          className="mt-3 rounded-lg border border-[#d9d4c6] bg-white px-4 py-2 text-xs font-bold text-[#18211f] hover:border-[#1f6f68]/40 hover:bg-[#1f6f68]/5"
                        >
                          Retake Selfie
                        </button>
                      </div>
                    ) : (
                      <div className="py-4">
                        <button
                          type="button"
                          onClick={startSelfieCamera}
                          className="mx-auto flex items-center justify-center gap-2 rounded-lg bg-[#1f6f68] px-4 py-3 text-xs font-bold text-white hover:bg-[#174c49]"
                        >
                          <Camera className="w-4 h-4" />
                          Open Camera
                        </button>
                        <p className="mt-3 text-[10px] text-[#66736f]">
                          Use the front camera. A large face guide will open before capture.
                        </p>
                      </div>
                    )}
                    {!cameraOpen && cameraError && (
                      <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        {cameraError}
                      </p>
                    )}
                    {(faceMatchLoading || faceMatchMessage || faceMatchScore !== null) && (
                      <div
                        className={`mt-3 rounded-lg border px-3 py-2 text-left text-xs ${
                          faceMatchStatus === 'passed'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : faceMatchStatus === 'failed'
                              ? 'border-red-200 bg-red-50 text-red-700'
                              : 'border-amber-200 bg-amber-50 text-amber-900'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-bold">Face Match</span>
                          <span className="text-sm font-black">
                            {faceMatchLoading || faceMatchStatus === 'checking'
                              ? 'Checking...'
                              : faceMatchScore === null
                                ? 'Manual Review'
                                : `${faceMatchScore}%`}
                          </span>
                        </div>
                        {faceMatchMessage && (
                          <p className="mt-1 leading-relaxed">{faceMatchMessage}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
                Your selfie is used only for identity review against your driver&apos;s license. Admin approval still requires manual review.
              </p>
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
