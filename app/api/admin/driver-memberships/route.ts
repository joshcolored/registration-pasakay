import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAdminDb } from '@/lib/firebaseAdmin';

type MembershipStatus = 'pending' | 'approved' | 'rejected';

const normalizeStatus = (status?: string): MembershipStatus => {
  if (status === 'approved' || status === 'rejected') return status;
  return 'pending';
};

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
