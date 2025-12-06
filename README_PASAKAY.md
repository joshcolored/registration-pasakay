# Pasakay Web Admin Dashboard

A modern web-based admin dashboard for the Pasakay tricycle ride-hailing app, built with Next.js 14, TypeScript, and Firebase.

## 🚀 Features

### ✅ Phase 1 (Completed)
- **Authentication**: Secure admin login with Firebase Auth
- **Dashboard Overview**: Real-time statistics and metrics
  - Total passengers, drivers, trips, and revenue
  - Active drivers count
  - Ongoing trips monitoring
  - Pending verifications alerts
- **Recent Trips**: View latest trip activities
- **Responsive Design**: Works on desktop, tablet, and mobile

### 🔄 Phase 2 (Coming Soon)
- **User Management**: View and manage all passengers
- **Driver Management**: View all drivers and their details
- **Driver Verification**: Approve/reject driver applications with document review
- **Payment Verification**: Verify driver subscription payments
- **Trip Management**: Detailed trip history and filtering

### 📋 Phase 3 (Planned)
- **Settings**: Configure fare rates and contact information
- **Reports & Analytics**: Generate detailed reports
- **Charts & Graphs**: Visual data representation
- **Export Data**: Download reports in various formats

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Database**: Firebase Realtime Database
- **Authentication**: Firebase Auth
- **Icons**: Lucide React
- **Charts**: Recharts (for future analytics)

## 📦 Installation

1. The project is already set up in `web-admin/` folder

2. Install dependencies (already done):
```bash
cd web-admin
npm install
```

3. Environment variables are configured in `.env.local`

## 🚀 Running the App

### Development Mode
```bash
npm run dev
```
Then open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build
```bash
npm run build
npm start
```

## 🔐 Admin Login

To access the admin dashboard, you need an admin account in Firebase:

1. Go to [http://localhost:3000](http://localhost:3000)
2. You'll be redirected to the login page
3. Enter admin credentials:
   - Email: (your admin email from Firebase)
   - Password: (your admin password)

**Note**: Only users with `userType: 'admin'` in the Firebase database can access the dashboard.

## 📁 Project Structure

```
web-admin/
├── app/
│   ├── dashboard/          # Dashboard pages
│   │   └── page.tsx        # Main dashboard
│   ├── login/              # Login page
│   │   └── page.tsx
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Home (redirects to login/dashboard)
├── components/
│   ├── DashboardLayout.tsx # Main layout with sidebar
│   └── StatsCard.tsx       # Reusable stats card component
├── lib/
│   └── firebase.ts         # Firebase configuration
├── types/
│   └── index.ts            # TypeScript type definitions
├── .env.local              # Environment variables
└── package.json
```

## 🔥 Firebase Configuration

The web admin uses the same Firebase project as your Android app:
- **Project ID**: pasakay-4f880
- **Database URL**: https://pasakay-4f880-default-rtdb.firebaseio.com
- **Storage**: pasakay-4f880.firebasestorage.app

## 📊 Dashboard Features

### Stats Cards
- **Total Passengers**: Count of all passenger users
- **Total Drivers**: Count of all driver users (with online count)
- **Total Trips**: All trips in the system (with ongoing count)
- **Total Revenue**: Sum of all completed trip fares

### Alert Cards
- **Pending Driver Verifications**: Drivers waiting for approval
- **Pending Payment Verifications**: Subscription payments to verify

### Recent Trips Table
- Shows last 5 trips
- Displays passenger, driver, route, fare, status, and time
- Color-coded status badges

## 🎨 UI/UX Features

- **Responsive Sidebar**: Collapsible on mobile, fixed on desktop
- **Gradient Branding**: Blue to purple gradient theme
- **Loading States**: Smooth loading animations
- **Error Handling**: User-friendly error messages
- **Real-time Updates**: Data syncs with Firebase in real-time

## 🔒 Security

- Admin-only access (checks `userType === 'admin'`)
- Firebase Authentication required
- Session management with localStorage
- Automatic logout on unauthorized access

## 🚧 Next Steps

1. **Test the dashboard**: Run `npm run dev` and login with admin credentials
2. **Add more pages**: User management, driver verification, etc.
3. **Enhance UI**: Add charts, graphs, and more visualizations
4. **Deploy**: Deploy to Vercel, Firebase Hosting, or your preferred platform

## 📝 Notes

- Make sure you have at least one admin user in your Firebase database
- The admin user must have `userType: 'admin'` in the `users` collection
- All data is real-time from your existing Firebase database
- No changes needed to your Android app - they share the same database

## 🆘 Troubleshooting

### Can't login?
- Ensure you have an admin account in Firebase
- Check that the user has `userType: 'admin'` in the database
- Verify Firebase credentials in `.env.local`

### Data not showing?
- Check Firebase Realtime Database rules
- Ensure the database URL is correct
- Check browser console for errors

### Build errors?
- Run `npm install` again
- Delete `node_modules` and `.next` folders, then reinstall
- Check Node.js version (should be 18+)

## 📧 Support

For issues or questions, check the Firebase console or review the code comments.

---

**Built with ❤️ for Pasakay**

