# Driver and Merchant Registration Pages

This document describes the new registration pages created for the Pasakay web-admin portal.

## Overview

The driver and merchant registration functionality has been moved from the mobile app to the web-admin portal. This provides a better user experience for onboarding new partners through a dedicated web interface.

## Pages Created

### 1. Registration Landing Page (`/register`)
- **File**: `app/register/page.tsx`
- **Purpose**: Landing page that presents two registration options
- **Features**:
  - Clean, modern design with gradient backgrounds
  - Two registration cards: Driver and Merchant
  - Benefits and requirements for each role
  - Navigation to respective registration forms
  - Admin login link in header
  - Footer with terms and policies

### 2. Driver Registration Page (`/register/driver`)
- **File**: `app/register/driver/page.tsx`
- **Features**:
  - Personal information form (name, email, phone)
  - Vehicle information (type, model, plate number, vehicle ID)
  - Document uploads (driver's license, OR/CR)
  - Image preview for uploaded documents
  - Password creation with visibility toggle
  - Terms of service checkbox
  - Form validation
  - Firebase integration for user creation
  - Email verification
  - Success message with next steps

**Fields Collected**:
- Full Name *
- Email Address *
- Phone Number *
- Vehicle Type * (Motorcycle/Tricycle)
- Vehicle Model *
- Plate Number *
- Vehicle Number/ID *
- Driver's License * (Upload)
- OR/CR Document * (Upload)
- Password *

### 3. Merchant Registration Page (`/register/merchant`)
- **File**: `app/register/merchant/page.tsx`
- **Features**:
  - Business logo upload with circular preview
  - Category selection (Restaurant, Cafe, Fast Food, Bakery, Desserts, Drinks, Grocery)
  - Business information form
  - Document uploads (business permit required, sanitary permit optional)
  - Image preview for all uploads
  - Password creation with visibility toggle
  - Terms of service checkbox
  - Form validation
  - Firebase integration
  - Success message with approval notice

**Fields Collected**:
- Business Logo (Optional)
- Business Category * (7 options with icons)
- Business Name *
- Owner Name *
- Phone Number *
- Email Address *
- Business Address *
- Business Description (Optional)
- Business Permit * (Upload - Required)
- Sanitary Permit (Upload - Optional)
- Password *

## Database Structure

### Driver Registration
Creates two database entries:
1. `/users/{uid}` - Basic user info with role: "driver"
2. `/drivers/{uid}` - Extended driver profile with:
   - Vehicle details
   - Document URLs
   - Verification status: "pending"
   - isApproved: false
   - Rating and earnings: 0

### Merchant Registration
Creates two database entries:
1. `/users/{uid}` - Basic user info with role: "merchant"
2. `/merchants/{uid}` - Extended merchant profile with:
   - Business details
   - Category
   - Document URLs
   - Status: "pending"
   - isOpen: false
   - Rating and orders: 0

## Firebase Storage Structure

### Driver Documents
- `drivers/{uid}/driver_license.jpg`
- `drivers/{uid}/or_cr.jpg`

### Merchant Documents
- `merchants/{uid}/logo.jpg`
- `merchants/{uid}/business_permit.jpg`
- `merchants/{uid}/sanitary_permit.jpg`

## Validation Rules

### Phone Number
- Format: 09XXXXXXXXX
- Length: Exactly 11 digits
- Must start with "09"

### Password
- Minimum 6 characters
- Must match confirmation password

### Required Documents
- **Driver**: Driver's license and OR/CR must be uploaded
- **Merchant**: Business permit must be uploaded (sanitary permit optional)

## User Flow

### Driver Registration Flow
1. User visits `/register`
2. Clicks "Register as Driver"
3. Fills out personal information
4. Fills out vehicle information
5. Uploads required documents
6. Creates password
7. Agrees to terms
8. Submits registration
9. Firebase creates user account
10. Documents uploaded to Firebase Storage
11. User and driver data saved to Realtime Database
12. Email verification sent
13. User is signed out (can't login until approved)
14. Success screen shows next steps

### Merchant Registration Flow
1. User visits `/register`
2. Clicks "Register as Merchant"
3. Uploads business logo (optional)
4. Selects business category
5. Fills out business information
6. Uploads required documents
7. Creates password
8. Agrees to terms
9. Submits registration
10. Firebase creates user account
11. Documents uploaded to Firebase Storage
12. User and merchant data saved to Realtime Database
13. Email verification sent
14. User is signed out
15. Success screen shows approval notice

## Admin Approval Process

Both driver and merchant registrations require admin approval:

1. User registers through web portal
2. Account created with status "pending"
3. isApproved: false
4. Admin receives notification (can be implemented)
5. Admin reviews documents in dashboard
6. Admin approves or rejects
7. User notified of approval status
8. Once approved, user can download mobile app and login

## Environment Variables Required

Make sure `.env.local` has these Firebase config variables:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_DATABASE_URL=your_database_url
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## Mobile App Changes Needed

To complete the migration, you should:

1. **Remove or hide driver registration from mobile app**
   - File: `lib/screens/auth/register_screen.dart`
   - Remove driver role option from registration
   - Or redirect to web registration

2. **Remove or hide merchant registration from mobile app**
   - File: `lib/screens/merchant/merchant_register_screen.dart`
   - Remove merchant registration route
   - Or redirect to web registration

3. **Update login screen**
   - Add message for new drivers/merchants to register via web
   - Provide web registration URL

## Testing Checklist

- [ ] Visit `/register` and verify both cards appear
- [ ] Click "Register as Driver" and verify form loads
- [ ] Click "Register as Merchant" and verify form loads
- [ ] Test driver registration with valid data
- [ ] Test merchant registration with valid data
- [ ] Verify file uploads work for all document types
- [ ] Test form validation (missing fields, password mismatch, etc.)
- [ ] Verify Firebase user creation
- [ ] Verify database entries created correctly
- [ ] Verify email verification sent
- [ ] Check success screens display properly
- [ ] Verify "Back" navigation works
- [ ] Test responsive design on mobile/tablet

## Deployment

To deploy these pages:

1. Ensure `.env.local` has all Firebase credentials
2. Run `npm run build` to build the Next.js app
3. Run `npm start` to start production server
4. Or deploy to Vercel/Netlify with environment variables configured

## Benefits of Web Registration

✅ Better UX for document uploads on desktop
✅ Easier form filling on larger screens
✅ Professional landing page for partner recruitment
✅ Centralized admin portal for all business operations
✅ Reduces mobile app size and complexity
✅ SEO benefits for partner recruitment
✅ Can be shared via marketing campaigns

## Future Enhancements

- Add Google Maps integration for business location selection
- Add real-time form validation
- Add document format validation (file size, type)
- Add progress indicators for multi-step forms
- Add SMS verification for phone numbers
- Add captcha for bot prevention
- Add admin notification system for new registrations
- Add status tracking page for applicants
