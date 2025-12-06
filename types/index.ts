// User Types
export interface User {
  userId: string;
  name: string;
  email: string;
  phoneNumber: string;
  userType: 'passenger' | 'driver' | 'admin';
  profileImageUrl?: string;
  driversLicenseUrl?: string;
  validIdUrl?: string;
  verificationStatus?: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  verifiedAt?: number;
  verifiedBy?: string;
  rating: number;
  totalTrips: number;
  createdAt: number;
  isActive: boolean;
}

// Driver Types
export interface Driver {
  driverId: string;
  userId: string;
  uid?: string; // Flutter uses 'uid'
  name?: string;
  email?: string;
  phoneNumber?: string;
  phone?: string; // Flutter uses 'phone'
  profileImageUrl?: string;
  profileImage?: string; // Flutter uses 'profileImage'
  driversLicenseUrl?: string;
  orCrUrl?: string; // OR/CR document URL
  validIdUrl?: string;
  vehicleNumber?: string;
  vehicleModel?: string;
  vehicleLicense?: string; // Flutter uses 'vehicleLicense'
  licenseNumber?: string;
  verificationStatus?: 'pending' | 'approved' | 'rejected' | string;
  status?: string; // Flutter uses 'status'
  rejectionReason?: string;
  verifiedAt?: number;
  verifiedBy?: string;
  rating?: number;
  totalTrips?: number;
  completedTrips?: number;
  totalEarnings?: number;
  isOnline?: boolean;
  online?: boolean; // Some fields use 'online'
  isActive?: boolean;
  currentLatitude?: number;
  currentLongitude?: number;
  currentLat?: number; // Flutter uses 'currentLat'
  currentLng?: number; // Flutter uses 'currentLng'
  lastLocationUpdate?: number;
  subscriptionType?: string;
  subscriptionPlan?: string; // Flutter uses 'subscriptionPlan'
  subscriptionStatus?: string;
  hasActiveSubscription?: boolean; // Flutter field
  subscriptionStartDate?: number;
  subscriptionEndDate?: number;
  subscriptionExpiry?: string; // Flutter uses ISO string
  createdAt?: number;
}

// Location Point Type (matches Flutter LocationPoint)
export interface LocationPoint {
  latitude: number;
  longitude: number;
  address: string;
}

// Trip Types
export interface Trip {
  tripId: string;
  passengerId: string;
  passengerName: string;
  passengerPhone?: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverVehicleNumber?: string;
  // Flutter uses LocationPoint objects
  pickupLocation?: LocationPoint;
  dropoffLocation?: LocationPoint;
  // Legacy flat fields
  pickupLatitude?: number;
  pickupLongitude?: number;
  pickupAddress?: string;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  dropoffAddress?: string;
  status: 'pending' | 'accepted' | 'ongoing' | 'completed' | 'cancelled' | string;
  // Fare fields
  fare?: number; // Flutter primary fare field
  estimatedFare?: number;
  finalFare?: number;
  currentFare?: number;
  distance?: number;
  actualDistance?: number;
  estimatedTime?: string;
  estimatedTimeSeconds?: number;
  passengerCount?: number;
  paymentMethod?: string;
  isPaid?: boolean;
  // Timestamps - Flutter uses ISO strings
  createdAt?: string | number;
  requestedAt?: number;
  acceptedAt?: string | number;
  startedAt?: string | number;
  completedAt?: string | number;
  driverRating?: number;
  passengerFeedback?: string;
}

// Payment Types
export interface Payment {
  paymentId: string;
  userId: string;
  driverName: string;
  driverPhone: string;
  plan: string;
  planName: string;
  amount: number;
  paymentMethod: string;
  status: 'pending_verification' | 'verified' | 'rejected';
  timestamp: number;
  submittedAt: string;
  verifiedBy?: string;
  verifiedAt?: number;
  rejectionReason?: string;
  receiptImageUrl?: string;
}

// Fare Settings Types (matches Flutter app structure)
// Formula: Total = Base + (Distance ÷ 2 × per2KmRate) + (Passengers × perPassengerRate)
export interface FareSettings {
  baseFare: number;
  per2KmRate: number; // Maps to per2KilometersRate in Firebase
  perPassengerRate: number; // Maps to perPassengerRate in Firebase
  minimumFare: number;
}

// Support Settings Types (matches Flutter app structure - stored in settings/support)
export interface SupportSettings {
  email: string;
  phone: string;
  facebookUrl: string;
  facebookName: string;
  supportHours: string;
}

// Dashboard Stats Types
export interface DashboardStats {
  totalUsers: number;
  totalDrivers: number;
  activeDrivers: number;
  totalTrips: number;
  totalRevenue: number;
  ongoingTrips: number;
  pendingPayments: number;
  pendingDrivers: number;
}

// App Settings Types (logo, branding)
export interface AppSettings {
  logoUrl?: string;
  appName?: string;
  updatedAt?: string;
  updatedBy?: string;
}

