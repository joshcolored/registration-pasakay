import { NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

const MAX_ATTEMPTS = 5;

function hashOtp(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function POST(request: Request) {
  try {
    const { uid } = await requireAdmin(request);
    const { email, userId, code } = await request.json();
    if (!email || !userId || !code) {
      return NextResponse.json({ error: "Missing email, userId, or code" }, { status: 400 });
    }
    if (userId !== uid) {
      return NextResponse.json({ error: "Unauthorized request." }, { status: 403 });
    }

    const db = getAdminDb();
    const otpRef = db.ref(`adminOtps/${userId}`);
    const snapshot = await otpRef.get();

    if (!snapshot.exists()) {
      return NextResponse.json({ error: "OTP not found. Please request a new code." }, { status: 400 });
    }

    const data = snapshot.val();
    const now = Date.now();

    if (data.email !== email) {
      return NextResponse.json({ error: "Email mismatch." }, { status: 400 });
    }

    if (data.expiresAt && now > data.expiresAt) {
      await otpRef.remove();
      return NextResponse.json({ error: "OTP expired. Please request a new code." }, { status: 400 });
    }

    const attempts = data.attempts || 0;
    if (attempts >= MAX_ATTEMPTS) {
      await otpRef.remove();
      return NextResponse.json({ error: "Too many attempts. Request a new code." }, { status: 429 });
    }

    const incomingHash = hashOtp(code);
    if (incomingHash !== data.otpHash) {
      await otpRef.update({ attempts: attempts + 1 });
      return NextResponse.json({ error: "Invalid code." }, { status: 400 });
    }

    await otpRef.remove();
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("verify-otp error", error);
    return NextResponse.json({ error: error.message || "Failed to verify OTP" }, { status: 500 });
  }
}
