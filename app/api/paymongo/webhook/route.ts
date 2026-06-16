import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

type MembershipPlan = '1_month' | '3_months';

const planDetails: Record<MembershipPlan, { label: string; flutterPlan: string; days: number }> = {
  '1_month': { label: '1 Month', flutterPlan: 'oneMonth', days: 30 },
  '3_months': { label: '3 Months', flutterPlan: 'threeMonths', days: 90 },
};

const toDateOnly = (value: number) => new Date(value).toISOString().slice(0, 10);

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

const normalizePlan = (plan: string): MembershipPlan | null => {
  if (plan === '1_month' || plan === 'oneMonth') return '1_month';
  if (plan === '3_months' || plan === 'threeMonths') return '3_months';
  return null;
};

const isAdminUser = (value: any) => {
  const role = String(value?.role || value?.userType || '').trim().toLowerCase();
  return role === 'admin';
};

async function createAdminNotification({
  title,
  message,
  type,
  relatedId,
}: {
  title: string;
  message: string;
  type: string;
  relatedId: string;
}) {
  const db = getAdminDb();
  const now = new Date().toISOString();
  const targets = new Set<string>();

  try {
    const usersSnapshot = await db.ref('users').get();
    if (usersSnapshot.exists()) {
      const users = usersSnapshot.val();
      Object.entries<any>(users).forEach(([uid, value]) => {
        if (isAdminUser(value)) targets.add(uid);
      });
    }
  } catch (error) {
    console.error('Error loading admin users for PayMongo notification:', error);
  }

  const targetIds = targets.size > 0 ? Array.from(targets) : [''];
  const updates: Record<string, any> = {};

  targetIds.forEach((adminId) => {
    const notificationRef = db.ref('notifications').push();
    const key = notificationRef.key;
    if (!key) return;

    updates[`notifications/${key}`] = {
      notificationId: randomUUID(),
      targetUserId: adminId,
      title,
      message,
      type,
      relatedId,
      isRead: false,
      createdAt: now,
      source: 'paymongo_webhook',
    };
  });

  if (Object.keys(updates).length > 0) {
    await db.ref().update(updates);
  }
}

const getWebhookEvent = (payload: any) => {
  const data = payload?.data || {};
  return {
    type: data?.attributes?.type || data?.type || '',
    session: data?.attributes?.data || data?.data || data,
  };
};

const findCheckoutByReference = async (referenceNumber: string, sessionId: string) => {
  const db = getAdminDb();
  const snapshot = await db.ref('driver_membership_checkout_sessions').get();
  const sessions = snapshot.val() || {};

  return Object.entries<any>(sessions).find(([, value]) => {
    return (
      value?.paymongoReferenceNumber === referenceNumber ||
      value?.paymongoCheckoutSessionId === sessionId
    );
  });
};

export async function POST(request: Request) {
  try {
    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
    if (webhookSecret) {
      const url = new URL(request.url);
      const providedSecret = url.searchParams.get('secret') || request.headers.get('x-paymongo-webhook-secret');
      if (providedSecret !== webhookSecret) {
        return NextResponse.json({ error: 'Invalid webhook secret.' }, { status: 401 });
      }
    }

    const payload = await request.json();
    const { type, session } = getWebhookEvent(payload);
    if (type !== 'checkout_session.payment.paid') {
      return NextResponse.json({ ok: true, ignored: type || 'unknown' });
    }

    const sessionAttributes = session?.attributes || {};
    const referenceNumber = String(sessionAttributes.reference_number || '').trim();
    const sessionId = String(session?.id || '').trim();
    const checkoutEntry = await findCheckoutByReference(referenceNumber, sessionId);

    if (!checkoutEntry) {
      console.error('PayMongo checkout session not found for webhook:', { referenceNumber, sessionId });
      return NextResponse.json({ ok: true, warning: 'checkout_not_found' });
    }

    const [requestId, checkout] = checkoutEntry;
    if (checkout?.status === 'approved') {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const driverId = checkout?.driverId || '';
    const normalizedPlan = normalizePlan(String(checkout?.plan || ''));
    if (!driverId || !normalizedPlan) {
      return NextResponse.json({ error: 'Checkout record is missing driver or plan.' }, { status: 400 });
    }

    const db = getAdminDb();
    const driverSnapshot = await db.ref(`drivers/${driverId}`).get();
    const driver = driverSnapshot.exists() ? driverSnapshot.val() : {};
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const currentExpiryMs = getExpiryMs(driver);
    const baseMs = currentExpiryMs > now ? currentExpiryMs : now;
    const expiresMs = baseMs + planDetails[normalizedPlan].days * 24 * 60 * 60 * 1000;
    const expiresAtDate = toDateOnly(expiresMs);
    const expiresAtIso = new Date(expiresMs).toISOString();
    const paymentId =
      sessionAttributes?.payments?.[0]?.id ||
      sessionAttributes?.payment_intent?.id ||
      sessionAttributes?.payment_intent_id ||
      sessionId ||
      referenceNumber;

    const paymentPayload = {
      requestId,
      driverId,
      driverName: checkout?.driverName || driver?.name || 'Driver',
      driverEmail: checkout?.driverEmail || driver?.email || '',
      driverPhone: checkout?.driverPhone || driver?.phone || driver?.phoneNumber || '',
      plan: normalizedPlan,
      planLabel: checkout?.planLabel || planDetails[normalizedPlan].label,
      amount: Number(checkout?.amount || 0),
      paymentMethod: 'paymongo_qrph',
      paymentReference: paymentId,
      paymongoReferenceNumber: referenceNumber,
      paymongoCheckoutSessionId: sessionId,
      paymongoTransactionId: paymentId,
      paymongoWebhookType: type,
      status: 'approved',
      source: 'paymongo_checkout',
      createdAt: checkout?.createdAt || nowIso,
      updatedAt: nowIso,
      reviewedAt: nowIso,
      reviewedBy: 'paymongo_webhook',
      membership_expires_at: expiresAtDate,
    };

    const updates: Record<string, any> = {
      [`driver_membership_checkout_sessions/${requestId}/status`]: 'approved',
      [`driver_membership_checkout_sessions/${requestId}/paidAt`]: nowIso,
      [`driver_membership_checkout_sessions/${requestId}/paymongoTransactionId`]: paymentId,
      [`driver_membership_checkout_sessions/${requestId}/updatedAt`]: nowIso,
      [`driver_membership_checkout_history/${driverId}/${requestId}/status`]: 'approved',
      [`driver_membership_checkout_history/${driverId}/${requestId}/paidAt`]: nowIso,
      [`driver_membership_checkout_history/${driverId}/${requestId}/paymongoTransactionId`]: paymentId,
      [`driver_membership_checkout_history/${driverId}/${requestId}/updatedAt`]: nowIso,
      [`driver_membership_payments/${requestId}`]: paymentPayload,
      [`driver_membership_payment_history/${driverId}/${requestId}`]: paymentPayload,
      [`drivers/${driverId}/membership_status`]: 'active',
      [`drivers/${driverId}/membership_started_at`]: toDateOnly(now),
      [`drivers/${driverId}/membership_expires_at`]: expiresAtDate,
      [`drivers/${driverId}/membership_plan`]: normalizedPlan,
      [`drivers/${driverId}/plan`]: normalizedPlan,
      [`drivers/${driverId}/membership_source`]: 'paymongo_qrph',
      [`drivers/${driverId}/membership_last_payment_id`]: requestId,
      [`drivers/${driverId}/membership_last_approved_at`]: nowIso,
      [`drivers/${driverId}/membership_last_transaction_id`]: paymentId,
      [`drivers/${driverId}/membership_pending_request_id`]: null,
      [`drivers/${driverId}/subscriptionStatus`]: 'active',
      [`drivers/${driverId}/subscriptionPlan`]: planDetails[normalizedPlan].flutterPlan,
      [`drivers/${driverId}/subscriptionType`]: planDetails[normalizedPlan].flutterPlan,
      [`drivers/${driverId}/subscriptionStartDate`]: now,
      [`drivers/${driverId}/subscriptionEndDate`]: expiresMs,
      [`drivers/${driverId}/subscriptionExpiry`]: expiresAtIso,
      [`drivers/${driverId}/hasActiveSubscription`]: true,
    };

    await db.ref().update(updates);

    await createAdminNotification({
      title: 'Driver Membership Auto Approved',
      message: `${paymentPayload.driverName}'s ${paymentPayload.planLabel} membership was paid through PayMongo QR Ph and is active until ${expiresAtDate}.`,
      type: 'paymentVerified',
      relatedId: requestId,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('PayMongo webhook error', error);
    return NextResponse.json(
      { error: error.message || 'Unable to process PayMongo webhook.' },
      { status: 500 }
    );
  }
}
