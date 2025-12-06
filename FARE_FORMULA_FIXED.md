# ✅ Web Admin Fare Formula - FIXED!

## 🎯 What Was Wrong

Your Next.js web admin had **incorrect fare calculations** that didn't match your mobile app.

### ❌ Before (WRONG):
```javascript
// Web admin calculated:
Fare = Base + (Distance × Rate) + Extra Person

Example: 5 km trip
Distance Cost = 5 × ₱10 = ₱50  ❌ WRONG!
```

### ✅ After (CORRECT):
```javascript
// Now matches mobile app:
Fare = Base + (Distance ÷ 2 × Rate/2km) + (Duration × Rate/min) + (Passengers × Rate/passenger)

Example: 5 km trip
Distance Cost = (5 ÷ 2) × ₱10 = ₱25  ✅ CORRECT!
```

---

## 📝 Changes Made

### 1. **Updated Database Path**
- **Before:** `fareSettings/default`
- **After:** `fareSettings` (root level, matching mobile app)

### 2. **Fixed Field Names**
```javascript
// Before
perKilometerRate: fareSettings.perKmRate  // Wrong calculation
perExtraPerson: fareSettings.bookingFee   // Wrong field

// After
perKilometerRate: fareSettings.perKmRate  // Per 2km rate ✅
perMinuteRate: fareSettings.perMinuteRate // Added ✅
perPassengerRate: fareSettings.perPassengerRate // Correct field ✅
```

### 3. **Updated Form Labels**
- ✅ "Per Kilometer Rate" → "Per 2 Kilometers Rate"
- ✅ "Per Extra Person" → Removed
- ✅ Added "Per Minute Rate" field
- ✅ Added "Per Passenger Rate" field

### 4. **Fixed Calculation Preview**
Now shows the **correct formula** with step-by-step breakdown:

```
Example: 5 km trip, 15 minutes, 3 passengers

Base Fare: ₱20
Distance: (5 ÷ 2) × ₱10 = ₱25  ← Divides by 2 ✅
Time: 15 × ₱2 = ₱30
Passengers: 3 × ₱5 = ₱15
─────────────────────
Total: ₱90 ✅
```

### 5. **Added Formula Display**
Shows the formula clearly in the UI:
```
Total = Base + (Distance ÷ 2 × Rate/2km) + (Duration × Rate/min) + (Passengers × Rate/passenger)
```

### 6. **Added Validation**
- ✅ Minimum fare cannot be less than base fare
- ✅ Shows if minimum fare is applied

---

## 🔄 Files Modified

1. **`app/dashboard/settings/page.tsx`** - Main settings page
   - Fixed fare loading logic
   - Fixed fare saving logic
   - Updated form fields
   - Fixed calculation preview
   - Added validation

2. **`types/index.ts`** - TypeScript definitions
   - Added `perPassengerRate` field
   - Updated field comments

---

## 📊 Example Comparison

### Scenario: 5 km trip, 15 minutes, 3 passengers

| Component | Before (❌) | After (✅) |
|-----------|-------------|-----------|
| Base Fare | ₱20 | ₱20 |
| Distance Cost | 5 × ₱10 = **₱50** | (5÷2) × ₱10 = **₱25** |
| Time Cost | Not included | 15 × ₱2 = ₱30 |
| Passenger Cost | 1 × ₱5 = ₱5 | 3 × ₱5 = ₱15 |
| **TOTAL** | **₱75** ❌ | **₱90** ✅ |

**Mobile app would calculate:** ₱90  
**Old web admin would show:** ₱75 (33% error!)  
**New web admin shows:** ₱90 ✅ Perfect match!

---

## 🚀 How to Test

### Step 1: Start the Web Admin
```bash
cd web-admin
npm run dev
```

### Step 2: Login
Go to http://localhost:3000 and login with admin credentials

### Step 3: Go to Settings
Click "Settings" in the sidebar

### Step 4: Configure Fare Settings
Set these test values:
- Base Fare: ₱20
- Per 2 Kilometers Rate: ₱10
- Per Minute Rate: ₱2
- Per Passenger Rate: ₱5
- Minimum Fare: ₱20

### Step 5: Check the Example
You should see:
```
Example Calculation
5 km trip, 15 minutes, 3 passengers:

₱90.00

Base Fare: ₱20.00
Distance: (5 ÷ 2) × ₱10.00 = ₱25.00
Time: 15 × ₱2.00 = ₱30.00
Passengers: 3 × ₱5.00 = ₱15.00
Total: ₱90.00
```

### Step 6: Save and Test in Mobile App
1. Click "Save Fare Settings"
2. Open your mobile app (passenger account)
3. Create a booking with same parameters
4. Verify fare matches: ₱90 ✅

---

## ✨ Benefits

### 1. **Accuracy**
- ✅ Web admin and mobile app now calculate identical fares
- ✅ No more fare discrepancies
- ✅ Drivers see correct expected earnings

### 2. **Transparency**
- ✅ Formula clearly displayed
- ✅ Step-by-step calculation shown
- ✅ Easy to understand pricing

### 3. **Real-time Sync**
- ✅ Changes in web admin → Instant update in mobile app
- ✅ All passengers see new rates immediately
- ✅ No app restart needed

---

## 🎯 Formula Breakdown

### The Correct Formula:
```
STEP 1: Calculate each component
  - Base Fare (fixed starting cost)
  - Distance Cost = (Distance ÷ 2) × Rate per 2km
  - Time Cost = Duration × Rate per minute
  - Passenger Cost = Number of passengers × Rate per passenger

STEP 2: Add them up
  Total = Base + Distance Cost + Time Cost + Passenger Cost

STEP 3: Apply minimum fare
  If Total < Minimum Fare:
    Final Fare = Minimum Fare
  Else:
    Final Fare = Total
```

### Why "÷ 2"?
The rate is **per 2 kilometers**, not per 1 kilometer!

Example:
- Rate: ₱10 per 2km
- Distance: 5 km
- Calculation: (5 ÷ 2) = 2.5 intervals × ₱10 = ₱25 ✅
- **NOT:** 5 km × ₱10 = ₱50 ❌

---

## 📱 Mobile App Compatibility

### Firebase Database Structure:
```json
{
  "fareSettings": {
    "baseFare": 20,
    "perKilometerRate": 10,
    "perMinuteRate": 2,
    "perPassengerRate": 5,
    "minimumFare": 20,
    "updatedAt": "2025-12-02T12:00:00.000Z"
  }
}
```

### Both Web and Mobile Read From Same Location:
- ✅ Web admin saves to `/fareSettings`
- ✅ Mobile app reads from `/fareSettings`
- ✅ Perfect sync!

---

## ⚠️ Important Notes

1. **Don't Use Old Fields**
   - ❌ `perExtraPerson` - Deprecated
   - ✅ Use `perPassengerRate` instead

2. **Rate is Per 2 Kilometers**
   - Not per 1 kilometer
   - Division by 2 is required

3. **Minimum Fare Protection**
   - Always >= Base Fare
   - Applies if calculated fare is too low

4. **Real-time Updates**
   - Changes take effect immediately
   - No need to restart mobile app

---

## 🆘 Troubleshooting

### Issue: Fares still don't match
**Check:**
1. Web admin is reading from `/fareSettings` (not `/fareSettings/default`)
2. Mobile app is reading from `/fareSettings`
3. Both use same calculation formula

### Issue: Example doesn't update
**Check:**
1. All input fields have values
2. No browser console errors
3. Try refreshing the page

### Issue: Can't save settings
**Check:**
1. Admin is logged in
2. Firebase rules allow admin write access
3. Minimum fare >= Base fare

---

## ✅ Verification Checklist

- [x] Web admin uses correct formula: `(distance ÷ 2) × rate`
- [x] Mobile app uses correct formula: `(distance ÷ 2) × rate`
- [x] Database path matches: `/fareSettings`
- [x] Field names match: `perKilometerRate`, `perMinuteRate`, `perPassengerRate`
- [x] Example calculation is correct
- [x] Formula is displayed in UI
- [x] Validation added
- [x] TypeScript types updated

---

## 🎉 Success!

Your web admin fare calculations now **perfectly match** your mobile app!

**Test it now:**
```bash
cd web-admin
npm run dev
```

Then go to Settings → Configure fares → Check example → Save → Test in mobile app ✅

---

**Built with ❤️ for Pasakay**  
*Fixed on: December 2, 2025*
