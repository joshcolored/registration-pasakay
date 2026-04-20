import { NextResponse } from "next/server";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_SENDS_PER_WINDOW = 3;
const SEND_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function getTransport(settings: any) {
  return nodemailer.createTransport({
    host: settings.host,
    port: Number(settings.port || 587),
    secure: settings.secure === true || Number(settings.port) === 465,
    auth: { user: settings.user, pass: settings.pass },
  });
}

async function getSmtpSettings() {
  const snapshot = await getAdminDb().ref("settings/smtp").get();
  if (snapshot.exists()) {
    const data = snapshot.val();
    if (data.host && data.user && data.pass) {
      return data;
    }
  }

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromEmail = process.env.SMTP_FROM || "no-reply@pasakay.com";

  if (!host || !user || !pass) {
    throw new Error("SMTP settings not configured.");
  }

  return {
    host,
    port,
    user,
    pass,
    fromEmail,
    fromName: "Pasakay Admin",
    secure: port === 465,
  };
}

function hashOtp(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function POST(request: Request) {
  try {
    const { uid } = await requireAdmin(request);
    const { email, userId } = await request.json();
    if (!email || !userId) {
      return NextResponse.json({ error: "Missing email or userId" }, { status: 400 });
    }
    if (userId !== uid) {
      return NextResponse.json({ error: "Unauthorized request." }, { status: 403 });
    }

    const db = getAdminDb();
    const otpRef = db.ref(`adminOtps/${userId}`);

    // rate limit sends
    const now = Date.now();
    const snapshot = await otpRef.get();
    const data = snapshot.exists() ? snapshot.val() : null;
    const sends = (data?.sends || []).filter((ts: number) => now - ts < SEND_WINDOW_MS);
    if (sends.length >= MAX_SENDS_PER_WINDOW) {
      return NextResponse.json({ error: "OTP send limit reached. Try later." }, { status: 429 });
    }

    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = now + OTP_TTL_MS;

    await otpRef.set({
      otpHash: hashOtp(code),
      expiresAt,
      attempts: 0,
      sends: [...sends, now],
      email,
    });

    const smtpSettings = await getSmtpSettings();
    const transporter = getTransport(smtpSettings);
    const fromName = smtpSettings.fromName ? `${smtpSettings.fromName} ` : "";
    const from = `${fromName}<${smtpSettings.fromEmail || "no-reply@pasakay.com"}>`;

    await transporter.sendMail({
      from,
      to: email,
      subject: "Pasakay Admin Login OTP",
      text: `Your Pasakay admin verification code is ${code}. It expires in 10 minutes.`,
      html: `<p>Your Pasakay admin verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`,
    });

    return NextResponse.json({ ok: true, expiresAt });
  } catch (error: any) {
    console.error("send-otp error", error);
    return NextResponse.json({ error: error.message || "Failed to send OTP" }, { status: 500 });
  }
}
