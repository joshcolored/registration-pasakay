import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

type MembershipPlan = '1_month' | '3_months';

const planDetails: Record<MembershipPlan, { label: string; days: number; amount: number }> = {
  '1_month': { label: '1 Month', days: 30, amount: 1 },
  '3_months': { label: '3 Months', days: 90, amount: 599 },
};

const validPlans = new Set<MembershipPlan>(['1_month', '3_months']);

const getExpiryMs = (driver: any) => {
  const value =
    driver?.membership_expires_at ||
    driver?.membership_expiresAt ||
    driver?.subscriptionExpiry ||
    driver?.subscriptionEndDate;

  if (!value) return 0;
  if (typeof value === 'number') return value;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
};

const getMembershipPlan = (driver: any): MembershipPlan | null => {
  const rawPlan = String(driver?.membership_plan || driver?.plan || driver?.subscriptionPlan || driver?.subscriptionType || '')
    .trim()
    .toLowerCase();

  if (rawPlan === '3_months' || rawPlan === 'threemonths' || rawPlan === 'three_months') return '3_months';
  if (rawPlan === '1_month' || rawPlan === 'onemonth' || rawPlan === 'one_month') return '1_month';
  return null;
};

const getBaseUrl = (request: Request) => {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.VERCEL_URL;
  if (configuredUrl) {
    return configuredUrl.startsWith('http') ? configuredUrl : `https://${configuredUrl}`;
  }

  const url = new URL(request.url);
  return url.origin;
};

export async function POST(request: Request) {
  try {
    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: 'PayMongo secret key is not configured.' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return NextResponse.json({ error: 'Missing authorization token.' }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    const body = await request.json();
    const plan = String(body?.plan || '') as MembershipPlan;

    if (!validPlans.has(plan)) {
      return NextResponse.json({ error: 'Invalid membership plan.' }, { status: 400 });
    }

    const db = getAdminDb();
    const driverSnapshot = await db.ref(`drivers/${decoded.uid}`).get();
    if (!driverSnapshot.exists()) {
      return NextResponse.json({ error: 'No driver profile was found for this account.' }, { status: 404 });
    }

    const driver = driverSnapshot.val();
    const activePlan = getMembershipPlan(driver);
    const isActive = getExpiryMs(driver) >= Date.now();
    if (isActive && activePlan === '3_months') {
      return NextResponse.json({ error: 'Your 3 Months membership is already active.' }, { status: 400 });
    }

    if (isActive && activePlan === '1_month' && plan === '1_month') {
      return NextResponse.json({ error: 'Your 1 Month membership is already active. You can upgrade to 3 Months.' }, { status: 400 });
    }

    const requestRef = db.ref('driver_membership_checkout_sessions').push();
    const requestId = requestRef.key;
    if (!requestId) {
      return NextResponse.json({ error: 'Unable to create checkout request.' }, { status: 500 });
    }

    const now = new Date().toISOString();
    const selectedPlan = planDetails[plan];
    const driverName = driver?.name || decoded.name || decoded.email || 'Driver';
    const baseUrl = getBaseUrl(request);
    const referenceNumber = `PASAKAY-${requestId}`;

    const payMongoResponse = await fetch('https://api.paymongo.com/v2/checkout_sessions', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [
              {
                name: `PaSakay Driver Membership - ${selectedPlan.label}`,
                amount: selectedPlan.amount * 100,
                currency: 'PHP',
                quantity: 1,
              },
            ],
            payment_method_types: ['qrph'],
            reference_number: referenceNumber,
            success_url: `${baseUrl}/driver-membership?checkout=success&requestId=${encodeURIComponent(requestId)}`,
            cancel_url: `${baseUrl}/driver-membership?checkout=cancelled&requestId=${encodeURIComponent(requestId)}`,
          },
        },
      }),
    });

    const payMongoData = await payMongoResponse.json();
    if (!payMongoResponse.ok) {
      const detail = payMongoData?.errors?.[0]?.detail || payMongoData?.errors?.[0]?.code;
      throw new Error(detail || 'Unable to create PayMongo checkout session.');
    }

    const checkoutSession = payMongoData?.data;
    const checkoutUrl = checkoutSession?.attributes?.checkout_url;
    if (!checkoutUrl) {
      throw new Error('PayMongo did not return a checkout URL.');
    }

    const checkoutPayload = {
      requestId,
      driverId: decoded.uid,
      driverName,
      driverEmail: decoded.email || driver?.email || '',
      driverPhone: driver?.phone || driver?.phoneNumber || '',
      plan,
      planLabel: selectedPlan.label,
      amount: selectedPlan.amount,
      paymentMethod: 'paymongo_qrph',
      status: 'awaiting_payment',
      source: 'paymongo_checkout',
      paymongoReferenceNumber: referenceNumber,
      paymongoCheckoutSessionId: checkoutSession?.id || '',
      checkoutUrl,
      createdAt: now,
      updatedAt: now,
    };

    await db.ref().update({
      [`driver_membership_checkout_sessions/${requestId}`]: checkoutPayload,
      [`driver_membership_checkout_history/${decoded.uid}/${requestId}`]: checkoutPayload,
    });

    return NextResponse.json({ checkoutUrl, requestId });
  } catch (error: any) {
    console.error('driver membership checkout error', error);
    return NextResponse.json(
      { error: error.message || 'Unable to start PayMongo checkout.' },
      { status: 500 }
    );
  }
}
