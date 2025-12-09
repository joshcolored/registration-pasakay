# Quick Setup Guide - Driver & Merchant Registration

## What Was Created

✅ **Landing Page** - `/register` - Beautiful page with driver and merchant registration options
✅ **Driver Registration** - `/register/driver` - Complete driver onboarding form
✅ **Merchant Registration** - `/register/merchant` - Complete merchant onboarding form

## Setup Instructions

### 1. Install Dependencies (if needed)
```bash
cd web-admin
npm install
```

### 2. Configure Firebase Environment Variables

Make sure your `.env.local` file has Firebase credentials:

```bash
# Copy from .env.example
cp .env.example .env.local

# Edit .env.local with your Firebase credentials
```

Your `.env.local` should have:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 3. Run Development Server
```bash
npm run dev
```

Visit: **http://localhost:3000**

The app will automatically redirect to the registration landing page.

## Testing the Registration Flow

### Test Driver Registration

1. Visit http://localhost:3000
2. Click "Register as Driver"
3. Fill in the form:
   - **Name**: John Doe
   - **Email**: driver@test.com
   - **Phone**: 09123456789
   - **Vehicle Type**: Motorcycle
   - **Vehicle Model**: Honda TMX 155
   - **Plate Number**: ABC 1234
   - **Vehicle ID**: MOT-001
   - Upload a test image for Driver's License
   - Upload a test image for OR/CR
   - **Password**: test123
   - **Confirm Password**: test123
   - ✓ Check "Agree to Terms"
4. Click "Register as Driver"
5. Should see success screen

### Test Merchant Registration

1. Visit http://localhost:3000
2. Click "Register as Merchant"
3. Upload a logo (optional)
4. Select a category (e.g., Restaurant 🍽️)
5. Fill in the form:
   - **Business Name**: Jollibee Makati
   - **Owner Name**: Juan Dela Cruz
   - **Phone**: 09123456789
   - **Email**: merchant@test.com
   - **Address**: 123 Makati Ave, Makati City
   - **Description**: Best fried chicken
   - Upload Business Permit image
   - Upload Sanitary Permit (optional)
   - **Password**: test123
   - **Confirm Password**: test123
   - ✓ Check "Agree to Terms"
6. Click "Register as Merchant"
7. Should see success screen

## Verify in Firebase

### Check Firebase Authentication
1. Go to Firebase Console > Authentication
2. New user should appear with the email you used
3. Email should be verified after clicking the link

### Check Realtime Database

**For Drivers:**
```
/users/{uid}
  - email, name, phone, role: "driver"

/drivers/{uid}
  - All driver info including vehicleType, documents, etc.
  - verificationStatus: "pending"
  - isApproved: false
```

**For Merchants:**
```
/users/{uid}
  - email, name, phone, role: "merchant"

/merchants/{uid}
  - All business info including category, documents, etc.
  - status: "pending"
  - isOpen: false
```

### Check Firebase Storage

**Drivers:**
- drivers/{uid}/driver_license.jpg
- drivers/{uid}/or_cr.jpg

**Merchants:**
- merchants/{uid}/logo.jpg (if uploaded)
- merchants/{uid}/business_permit.jpg
- merchants/{uid}/sanitary_permit.jpg (if uploaded)

## URL Routes

| Route | Description |
|-------|-------------|
| `/` | Auto-redirects to `/register` (or `/pasakay/login` with `?admin` param) |
| `/register` | Landing page with driver/merchant options |
| `/register/driver` | Driver registration form |
| `/register/merchant` | Merchant registration form |
| `/pasakay/login` | Admin login (hidden, direct access only) |
| `/dashboard` | Admin dashboard (requires authentication) |

## Next Steps: Mobile App Changes

To complete the migration, update the mobile app:

### Option 1: Remove Registration from Mobile App

**File: `lib/screens/auth/register_screen.dart`**
- Remove driver option from `_selectedRole` (only keep passenger)
- Or remove entire registration screen for drivers

**File: `lib/screens/merchant/merchant_register_screen.dart`**
- Remove this screen entirely or redirect to web

### Option 2: Redirect to Web Registration

Add a message in the mobile app login screen:

```dart
// In login_screen.dart
TextButton(
  onPressed: () async {
    final url = 'https://your-domain.com/register';
    if (await canLaunchUrl(Uri.parse(url))) {
      await launchUrl(Uri.parse(url));
    }
  },
  child: Text('Register as Driver/Merchant (Web)'),
)
```

## Admin Dashboard Integration

The admin dashboard should already have:
- Driver verification screen
- Merchant management screen

New registrations will appear with:
- **Drivers**: `verificationStatus: "pending"`, `isApproved: false`
- **Merchants**: `status: "pending"`

Admin can approve/reject from the dashboard.

## Production Deployment

### Deploy to Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

### Deploy to Other Hosting

1. Build the app:
   ```bash
   npm run build
   ```

2. Start production server:
   ```bash
   npm start
   ```

3. Or export static files:
   ```bash
   npm run export
   ```

## Troubleshooting

### Issue: Firebase not initialized
**Solution**: Check `.env.local` has all Firebase config variables

### Issue: File upload not working
**Solution**: 
- Check Firebase Storage rules
- Verify storage bucket name in config
- Check file size (default 5MB limit)

### Issue: User created but not in database
**Solution**: Check Firebase Realtime Database rules allow writes

### Issue: Email verification not sent
**Solution**: 
- Check Firebase Authentication email settings
- Verify sender email configured
- Check spam folder

## Features

✨ **Beautiful UI** - Modern, gradient design
✨ **Responsive** - Works on mobile, tablet, desktop
✨ **Image Previews** - See documents before upload
✨ **Form Validation** - Client-side validation
✨ **Password Toggle** - Show/hide password
✨ **Success Screens** - Clear next steps
✨ **Firebase Integration** - Complete backend
✨ **Category Icons** - Visual merchant categories

## Support

For issues or questions:
1. Check REGISTRATION_PAGES.md for detailed documentation
2. Review Firebase console for errors
3. Check browser console for JavaScript errors
4. Verify environment variables are set correctly

---

**Created**: December 2025
**Last Updated**: December 2025
