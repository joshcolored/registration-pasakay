import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

function buildTransport(settings: any) {
  return nodemailer.createTransport({
    host: settings.host,
    port: Number(settings.port || 587),
    secure: settings.secure === true || Number(settings.port) === 465,
    auth: {
      user: settings.user,
      pass: settings.pass,
    },
  });
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: "Missing test email." }, { status: 400 });
    }

    const snapshot = await getAdminDb().ref("settings/smtp").get();
    if (!snapshot.exists()) {
      return NextResponse.json({ error: "SMTP settings not configured." }, { status: 400 });
    }
    const settings = snapshot.val();
    if (!settings.host || !settings.user || !settings.pass || !settings.fromEmail) {
      return NextResponse.json({ error: "SMTP settings incomplete." }, { status: 400 });
    }

    const transporter = buildTransport(settings);
    const fromName = settings.fromName ? `${settings.fromName} ` : "";
    const from = `${fromName}<${settings.fromEmail}>`;

    await transporter.sendMail({
      from,
      to: email,
      subject: "Pasakay SMTP Test",
      text: "This is a test email from Pasakay admin SMTP settings.",
      html: "<p>This is a test email from Pasakay admin SMTP settings.</p>",
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("smtp test error", error);
    return NextResponse.json({ error: error.message || "Failed to send test email." }, { status: 500 });
  }
}
