import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

const toIsoDate = (value: unknown) => {
  if (!value) return null;
  if (typeof value === 'number') return new Date(value).toISOString().slice(0, 10);
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
};

const normalizeStatus = (driver: any) => {
  const explicit = String(driver?.membership_status || '').trim().toLowerCase();
  if (['active', 'inactive', 'expired', 'pending'].includes(explicit)) {
    if (explicit === 'active') {
      const expiresAt = toIsoDate(driver?.membership_expires_at);
      if (expiresAt && new Date(expiresAt).getTime() < Date.now()) return 'expired';
    }
    return explicit;
  }

  const subscriptionStatus = String(driver?.subscriptionStatus || '').trim().toLowerCase();
  const hasActiveSubscription = driver?.hasActiveSubscription === true;
  const subscriptionExpiry = toIsoDate(driver?.subscriptionExpiry || driver?.subscriptionEndDate);
  if ((subscriptionStatus === 'active' || hasActiveSubscription) && subscriptionExpiry) {
    return new Date(subscriptionExpiry).getTime() >= Date.now() ? 'active' : 'expired';
  }

  return 'inactive';
};

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return NextResponse.json({ error: 'Missing authorization token.' }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    const driverSnapshot = await getAdminDb().ref(`drivers/${decoded.uid}`).get();
    const driver = driverSnapshot.exists() ? driverSnapshot.val() : {};
    const status = normalizeStatus(driver);

    return NextResponse.json({
      status,
      plan: driver?.plan || driver?.membership_plan || driver?.subscriptionPlan || driver?.subscriptionType || null,
      started_at: toIsoDate(driver?.membership_started_at || driver?.subscriptionStartDate),
      expires_at: toIsoDate(driver?.membership_expires_at || driver?.membership_expiresAt || driver?.subscriptionExpiry || driver?.subscriptionEndDate),
      source: driver?.membership_source || driver?.subscriptionSource || 'web_portal',
    });
  } catch (error: any) {
    console.error('driver membership status error', error);
    return NextResponse.json(
      { error: error.message || 'Unable to load membership status.' },
      { status: 500 }
    );
  }
}
