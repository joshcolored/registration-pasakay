import { getAdminAuth, getAdminDb } from "./firebaseAdmin";

export async function requireAdmin(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    throw new Error("Missing authorization token.");
  }

  const decoded = await getAdminAuth().verifyIdToken(token);
  const uid = decoded.uid;

  const userSnap = await getAdminDb().ref(`users/${uid}`).get();
  if (!userSnap.exists()) {
    throw new Error("User not found.");
  }

  const userData = userSnap.val();
  if (userData.userType !== "admin") {
    throw new Error("Admin access required.");
  }

  return { uid, userData };
}
