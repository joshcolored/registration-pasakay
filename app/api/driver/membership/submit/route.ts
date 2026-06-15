import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

type MembershipPlan = '1_month' | '3_months';
type PaymentMethod = 'gcash' | 'maya' | 'card' | 'bank_transfer';

const validPlans = new Set<MembershipPlan>(['1_month', '3_months']);
const validPaymentMethods = new Set<PaymentMethod>(['gcash', 'maya', 'card', 'bank_transfer']);

const isAdminUser = (value: any) => {
  const role = String(value?.role || value?.userType || '').trim().toLowerCase();
  return role === 'admin';
};

async function createAdminNotification({
  title,
  message,
  relatedId,
}: {
  title: string;
  message: string;
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
    console.error('Error loading admin users for membership notification:', error);
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
      type: 'paymentSubmitted',
      relatedId,
      isRead: false,
      createdAt: now,
      source: 'web-admin',
    };
  });

  if (Object.keys(updates).length > 0) {
    await db.ref().update(updates);
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return NextResponse.json({ error: 'Missing authorization token.' }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    const body = await request.json();
    const plan = String(body?.plan || '') as MembershipPlan;
    const paymentMethod = String(body?.paymentMethod || '') as PaymentMethod;
    const paymentReference = String(body?.paymentReference || '').trim();

    if (!validPlans.has(plan)) {
      return NextResponse.json({ error: 'Invalid membership plan.' }, { status: 400 });
    }

    if (!validPaymentMethods.has(paymentMethod)) {
      return NextResponse.json({ error: 'Invalid payment method.' }, { status: 400 });
    }

    if (!paymentReference) {
      return NextResponse.json({ error: 'Payment reference is required.' }, { status: 400 });
    }

    const db = getAdminDb();
    const driverSnapshot = await db.ref(`drivers/${decoded.uid}`).get();
    if (!driverSnapshot.exists()) {
      return NextResponse.json({ error: 'No driver profile was found for this account.' }, { status: 404 });
    }

    const driver = driverSnapshot.val();
    const requestRef = db.ref('driver_membership_payments').push();
    const requestId = requestRef.key;
    if (!requestId) {
      return NextResponse.json({ error: 'Unable to create membership request.' }, { status: 500 });
    }

    const now = new Date().toISOString();
    const driverName = driver?.name || decoded.name || decoded.email || 'Driver';
    const planLabel = String(body?.planLabel || (plan === '1_month' ? '1 Month' : '3 Months'));
    const membershipStatus = String(driver?.membership_status || 'inactive').toLowerCase();

    const payload = {
      requestId,
      driverId: decoded.uid,
      driverName,
      driverEmail: decoded.email || driver?.email || '',
      driverPhone: driver?.phone || driver?.phoneNumber || '',
      plan,
      planLabel,
      amount: Number(body?.amount || 0),
      paymentMethod,
      paymentReference,
      proofUrl: String(body?.proofUrl || ''),
      proofPublicId: String(body?.proofPublicId || ''),
      proofFileName: String(body?.proofFileName || ''),
      proofContentType: String(body?.proofContentType || ''),
      proofSize: Number(body?.proofSize || 0),
      status: 'pending',
      source: 'driver_membership_portal',
      createdAt: now,
      updatedAt: now,
    };

    const updates: Record<string, any> = {
      [`driver_membership_payments/${requestId}`]: payload,
      [`driver_membership_payment_history/${decoded.uid}/${requestId}`]: payload,
    };

    if (membershipStatus !== 'active') {
      updates[`drivers/${decoded.uid}/membership_status`] = 'pending';
      updates[`drivers/${decoded.uid}/membership_pending_request_id`] = requestId;
      updates[`drivers/${decoded.uid}/membership_pending_at`] = now;
    }

    await db.ref().update(updates);

    try {
      await createAdminNotification({
        title: 'Driver Membership Submitted',
        message: `${driverName} submitted a ${planLabel} membership request.`,
        relatedId: requestId,
      });
    } catch (notificationError) {
      console.error('Unable to create driver membership notification:', notificationError);
    }

    return NextResponse.json({ requestId });
  } catch (error: any) {
    console.error('driver membership submit error', error);
    return NextResponse.json(
      { error: error.message || 'Unable to submit membership request.' },
      { status: 500 }
    );
  }
}
