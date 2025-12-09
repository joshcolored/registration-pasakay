# Admin Access - Security Information

## Admin Login URL

For security reasons, the admin login is **not linked** from public-facing pages and uses an obscured path.

### Direct Admin Access:

**Production URL:** `https://pasakay-web-admin.vercel.app/pasakay/login`

**Development URL:** `http://localhost:3000/pasakay/login`

**Alternative (with hint):** `https://pasakay-web-admin.vercel.app/?admin` (auto-redirects to login)

## Security Measures

✅ **No public links** - Admin login is not advertised on registration pages
✅ **Direct URL only** - Admins must know the exact URL
✅ **Email verification required** - Users must verify email before login
✅ **Role-based access** - Only users with `role: 'admin'` can access dashboard
✅ **Session management** - Uses localStorage for session persistence

## Creating Admin Accounts

Admin accounts must be created manually in Firebase:

### Method 1: Firebase Console
1. Go to Firebase Console > Authentication
2. Add user manually
3. Go to Realtime Database
4. Add user data to `/users/{uid}`:
```json
{
  "uid": "admin-uid",
  "email": "admin@pasakay.com",
  "name": "Admin Name",
  "phone": "09XXXXXXXXX",
  "role": "admin",
  "isActive": true,
  "createdAt": "2025-12-09T00:00:00.000Z"
}
```

### Method 2: Firebase Admin SDK (Recommended)
Use a server-side script with Firebase Admin SDK to create admin users.

## Admin Dashboard Access

After logging in, admins have access to:
- Dashboard overview
- Driver management & verification
- Passenger management
- Merchant management & approval
- Trip monitoring
- Fare settings
- Payment settings
- Subscription settings
- Service area management
- Reports & analytics
- System notifications

## Best Practices

🔒 **Keep admin URL private** - Don't share publicly
🔒 **Use strong passwords** - Minimum 12 characters with special characters
🔒 **Limit admin accounts** - Only create what's necessary
🔒 **Monitor access logs** - Check Firebase for suspicious activity
🔒 **Use 2FA** - Enable two-factor authentication in Firebase if possible
🔒 **Regular password rotation** - Change passwords periodically

## Accessing Admin Panel

### For Development:
```
http://localhost:3000/pasakay/login
```

### For Production:
```
https://pasakay-web-admin.vercel.app/pasakay/login
```

### Alternative Access (with hint):
```
https://your-domain.com/?admin
```
The `?admin` query parameter will auto-redirect to the login page.

**Note:** Bookmark the direct URL. It is intentionally not linked from public pages and uses an obscured path for additional security.

## Troubleshooting

### Can't access admin dashboard:
1. Verify you're using the correct email/password
2. Check Firebase Console that user has `role: 'admin'`
3. Verify email is confirmed
4. Check browser localStorage for `adminUser` key
5. Try clearing cache and logging in again

### Lost admin access:
1. Reset password via Firebase Console
2. Or create a new admin account via Firebase Console
3. Or use Firebase Admin SDK to reset credentials

## Emergency Access

If you lose all admin access:

1. Go to Firebase Console
2. Authentication > Users
3. Create new user with admin email
4. Realtime Database > /users/{new-uid}
5. Set `role: 'admin'`
6. Use password reset link
7. Login with new credentials

---

**Important:** Keep this information confidential. Never commit actual credentials to git.
