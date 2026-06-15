import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { requireAdmin } from '@/lib/adminAuth';
import { getAdminDb } from '@/lib/firebaseAdmin';

type MembershipStatus = 'pending' | 'approved' | 'rejected';
type MembershipPlan = '1_month' | '3_months';

const planDetails: Record<MembershipPlan, { label: string; flutterPlan: string; days: number }> = {
  '1_month': { label: '1 Month', flutterPlan: 'oneMonth', days: 30 },
  '3_months': { label: '3 Months', flutterPlan: 'threeMonths', days: 90 },
};

const normalizeStatus = (status?: string): MembershipStatus => {
  if (status === 'approved' || status === 'rejected') return status;
  return 'pending';
};

const normalizePlan = (plan: string): MembershipPlan | null => {
  if (plan === '1_month' || plan === 'oneMonth') return '1_month';
  if (plan === '3_months' || plan === 'threeMonths') return '3_months';
  return null;
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
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const isAdminUser = (value: any) => {
  const role = String(value?.role || value?.userType || '').trim().toLowerCase();
  return role === 'admin';
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function getTransport(settings: any) {
  return nodemailer.createTransport({
    host: settings.host,
    port: Number(settings.port || 587),
    secure: settings.secure === true || Number(settings.port) === 465,
    auth: { user: settings.user, pass: settings.pass },
  });
}

async function getSmtpSettings() {
  const snapshot = await getAdminDb().ref('settings/smtp').get();
  if (snapshot.exists()) {
    const data = snapshot.val();
    if (data.host && data.user && data.pass && data.fromEmail) {
      return data;
    }
  }

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromEmail = process.env.SMTP_FROM || 'no-reply@pasakay.com';

  if (!host || !user || !pass) {
    throw new Error('SMTP settings not configured.');
  }

  return {
    host,
    port,
    user,
    pass,
    fromEmail,
    fromName: 'Pasakay Admin',
    secure: port === 465,
  };
}

async function sendDriverMembershipEmail({
  to,
  driverName,
  status,
  planLabel,
  expiresAt,
  rejectionReason,
}: {
  to?: string;
  driverName: string;
  status: 'approved' | 'rejected';
  planLabel?: string;
  expiresAt?: string;
  rejectionReason?: string;
}) {
  if (!to) return;

  const smtpSettings = await getSmtpSettings();
  const transporter = getTransport(smtpSettings);
  const fromName = smtpSettings.fromName ? `${smtpSettings.fromName} ` : '';
  const from = `${fromName}<${smtpSettings.fromEmail || 'no-reply@pasakay.com'}>`;
  const greetingName = driverName || 'Driver';
  const safeGreetingName = escapeHtml(greetingName);
  const safePlanLabel = escapeHtml(planLabel || 'driver');
  const safeExpiresAt = expiresAt ? escapeHtml(expiresAt) : '';
  const safeRejectionReason = rejectionReason ? escapeHtml(rejectionReason) : '';

  if (status === 'approved') {
    await transporter.sendMail({
      from,
      to,
      subject: 'Your PaSakay driver membership was approved',
      text: `Hi ${greetingName}, your ${planLabel || 'driver'} membership has been approved.${
        expiresAt ? ` It is active until ${expiresAt}.` : ''
      } You can now continue using your PaSakay driver account.`,
      html: `<p>Hi ${safeGreetingName},</p><p>Your <strong>${safePlanLabel} membership</strong> has been approved.</p>${
        safeExpiresAt ? `<p>It is active until <strong>${safeExpiresAt}</strong>.</p>` : ''
      }<p>You can now continue using your PaSakay driver account.</p>`,
    });
    return;
  }

  await transporter.sendMail({
    from,
    to,
    subject: 'Your PaSakay driver membership request was denied',
    text: `Hi ${greetingName}, your ${planLabel || 'driver'} membership request was denied.${
      rejectionReason ? ` Reason: ${rejectionReason}` : ''
    } Please review your payment details and submit a new request if needed.`,
    html: `<p>Hi ${safeGreetingName},</p><p>Your <strong>${safePlanLabel} membership request</strong> was denied.</p>${
      safeRejectionReason ? `<p><strong>Reason:</strong> ${safeRejectionReason}</p>` : ''
    }<p>Please review your payment details and submit a new request if needed.</p>`,
  });
}

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
      type,
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

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const snapshot = await getAdminDb().ref('driver_membership_payments').get();
    const data = snapshot.val() || {};

    const payments = Object.entries<any>(data)
      .map(([id, value]) => ({
        ...value,
        requestId: value?.requestId || id,
        driverId: value?.driverId || value?.userId || '',
        driverName: value?.driverName || 'N/A',
        status: normalizeStatus(value?.status),
      }))
      .sort((a, b) => {
        const aTime = Date.parse(a.createdAt || '') || 0;
        const bTime = Date.parse(b.createdAt || '') || 0;
        return bTime - aTime;
      });

    return NextResponse.json({ payments });
  } catch (error: any) {
    console.error('admin driver memberships list error', error);
    return NextResponse.json(
      { error: error.message || 'Unable to load membership requests.' },
      { status: error.message === 'Admin access required.' ? 403 : 401 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const body = await request.json();
    const action = String(body?.action || '');
    const requestId = String(body?.requestId || '').trim();

    if (!requestId) {
      return NextResponse.json({ error: 'Missing membership request ID.' }, { status: 400 });
    }

    const db = getAdminDb();
    const paymentSnapshot = await db.ref(`driver_membership_payments/${requestId}`).get();
    if (!paymentSnapshot.exists()) {
      return NextResponse.json({ error: 'Membership request not found.' }, { status: 404 });
    }

    const payment = paymentSnapshot.val();
    const driverId = payment?.driverId || payment?.userId || '';
    if (!driverId) {
      return NextResponse.json({ error: 'Membership request is missing a driver ID.' }, { status: 400 });
    }

    if (action === 'approve') {
      const normalizedPlan = normalizePlan(String(payment?.plan || ''));
      if (!normalizedPlan) {
        return NextResponse.json({ error: `Unsupported membership plan: ${payment?.plan || 'N/A'}` }, { status: 400 });
      }

      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const driverSnapshot = await db.ref(`drivers/${driverId}`).get();
      const driver = driverSnapshot.exists() ? driverSnapshot.val() : {};
      const currentExpiryMs = getExpiryMs(driver);
      const baseMs = currentExpiryMs > now ? currentExpiryMs : now;
      const expiresMs = baseMs + planDetails[normalizedPlan].days * 24 * 60 * 60 * 1000;
      const expiresAtDate = toDateOnly(expiresMs);
      const expiresAtIso = new Date(expiresMs).toISOString();
      const updates: Record<string, any> = {};

      updates[`driver_membership_payments/${requestId}/status`] = 'approved';
      updates[`driver_membership_payments/${requestId}/reviewedAt`] = nowIso;
      updates[`driver_membership_payments/${requestId}/reviewedBy`] = admin.uid;
      updates[`driver_membership_payments/${requestId}/membership_expires_at`] = expiresAtDate;
      updates[`driver_membership_payment_history/${driverId}/${requestId}/status`] = 'approved';
      updates[`driver_membership_payment_history/${driverId}/${requestId}/reviewedAt`] = nowIso;
      updates[`driver_membership_payment_history/${driverId}/${requestId}/reviewedBy`] = admin.uid;
      updates[`driver_membership_payment_history/${driverId}/${requestId}/membership_expires_at`] = expiresAtDate;

      updates[`drivers/${driverId}/membership_status`] = 'active';
      updates[`drivers/${driverId}/membership_started_at`] = toDateOnly(now);
      updates[`drivers/${driverId}/membership_expires_at`] = expiresAtDate;
      updates[`drivers/${driverId}/membership_plan`] = normalizedPlan;
      updates[`drivers/${driverId}/plan`] = normalizedPlan;
      updates[`drivers/${driverId}/membership_source`] = 'web_portal';
      updates[`drivers/${driverId}/membership_last_payment_id`] = requestId;
      updates[`drivers/${driverId}/membership_last_approved_at`] = nowIso;
      updates[`drivers/${driverId}/membership_pending_request_id`] = null;

      updates[`drivers/${driverId}/subscriptionStatus`] = 'active';
      updates[`drivers/${driverId}/subscriptionPlan`] = planDetails[normalizedPlan].flutterPlan;
      updates[`drivers/${driverId}/subscriptionType`] = planDetails[normalizedPlan].flutterPlan;
      updates[`drivers/${driverId}/subscriptionStartDate`] = now;
      updates[`drivers/${driverId}/subscriptionEndDate`] = expiresMs;
      updates[`drivers/${driverId}/subscriptionExpiry`] = expiresAtIso;
      updates[`drivers/${driverId}/hasActiveSubscription`] = true;

      await db.ref().update(updates);

      await createAdminNotification({
        title: 'Driver Membership Approved',
        message: `${payment?.driverName || 'Driver'}'s membership is active until ${expiresAtDate}.`,
        type: 'paymentVerified',
        relatedId: requestId,
      });

      try {
        await sendDriverMembershipEmail({
          to: payment?.driverEmail,
          driverName: payment?.driverName || 'Driver',
          status: 'approved',
          planLabel: payment?.planLabel || planDetails[normalizedPlan].label,
          expiresAt: expiresAtDate,
        });
      } catch (emailError) {
        console.error('Unable to send driver membership approval email:', emailError);
      }

      return NextResponse.json({ ok: true });
    }

    if (action === 'reject') {
      const rejectionReason = String(body?.rejectionReason || '').trim();
      if (!rejectionReason) {
        return NextResponse.json({ error: 'Rejection reason is required.' }, { status: 400 });
      }

      const nowIso = new Date().toISOString();
      const updates: Record<string, any> = {};

      updates[`driver_membership_payments/${requestId}/status`] = 'rejected';
      updates[`driver_membership_payments/${requestId}/rejectionReason`] = rejectionReason;
      updates[`driver_membership_payments/${requestId}/reviewedAt`] = nowIso;
      updates[`driver_membership_payments/${requestId}/reviewedBy`] = admin.uid;
      updates[`driver_membership_payment_history/${driverId}/${requestId}/status`] = 'rejected';
      updates[`driver_membership_payment_history/${driverId}/${requestId}/rejectionReason`] = rejectionReason;
      updates[`driver_membership_payment_history/${driverId}/${requestId}/reviewedAt`] = nowIso;
      updates[`driver_membership_payment_history/${driverId}/${requestId}/reviewedBy`] = admin.uid;

      const driverSnapshot = await db.ref(`drivers/${driverId}`).get();
      const driver = driverSnapshot.exists() ? driverSnapshot.val() : {};
      if (driver?.membership_pending_request_id === requestId) {
        updates[`drivers/${driverId}/membership_status`] = 'inactive';
        updates[`drivers/${driverId}/membership_pending_request_id`] = null;
      }

      await db.ref().update(updates);

      await createAdminNotification({
        title: 'Driver Membership Rejected',
        message: `${payment?.driverName || 'Driver'}'s membership request was rejected.`,
        type: 'paymentRejected',
        relatedId: requestId,
      });

      try {
        const normalizedPlan = normalizePlan(String(payment?.plan || ''));
        await sendDriverMembershipEmail({
          to: payment?.driverEmail,
          driverName: payment?.driverName || 'Driver',
          status: 'rejected',
          planLabel: payment?.planLabel || (normalizedPlan ? planDetails[normalizedPlan].label : undefined),
          rejectionReason,
        });
      } catch (emailError) {
        console.error('Unable to send driver membership rejection email:', emailError);
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unsupported membership action.' }, { status: 400 });
  } catch (error: any) {
    console.error('admin driver memberships action error', error);
    return NextResponse.json(
      { error: error.message || 'Unable to update membership request.' },
      { status: error.message === 'Admin access required.' ? 403 : 401 }
    );
  }
}
