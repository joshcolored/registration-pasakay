import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const snapshot = await getAdminDb().ref("settings/smtp").get();
    if (!snapshot.exists()) {
      return NextResponse.json({ ok: true, data: null });
    }
    const data = snapshot.val();
    return NextResponse.json({
      ok: true,
      data: {
        host: data.host || "",
        port: data.port || 587,
        user: data.user || "",
        fromEmail: data.fromEmail || "",
        fromName: data.fromName || "",
        secure: data.secure === true,
        hasPass: !!data.pass,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const { uid } = await requireAdmin(request);
    const body = await request.json();
    const host = (body.host || "").trim();
    const port = Number(body.port || 587);
    const user = (body.user || "").trim();
    const fromEmail = (body.fromEmail || "").trim();
    const fromName = (body.fromName || "").trim();
    const secure = body.secure === true;
    const pass = (body.pass || "").toString();

    if (!host || !user || !fromEmail) {
      return NextResponse.json({ error: "Host, username, and from email are required." }, { status: 400 });
    }

    const smtpRef = getAdminDb().ref("settings/smtp");
    const existingSnap = await smtpRef.get();
    const existing = existingSnap.exists() ? existingSnap.val() : {};

    await smtpRef.update({
      host,
      port,
      user,
      fromEmail,
      fromName,
      secure,
      pass: pass ? pass : existing.pass || "",
      updatedAt: new Date().toISOString(),
      updatedBy: uid,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to save SMTP settings" }, { status: 500 });
  }
}
