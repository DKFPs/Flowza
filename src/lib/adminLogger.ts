import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "./firebase";

export async function logAdminAction(action: string, details: Record<string, any> = {}, status: "success" | "error" | "pending" = "success") {
    try {
        if (!auth.currentUser) return;
        
        await addDoc(collection(db, "admin_audit_logs"), {
            adminUid: auth.currentUser.uid,
            adminEmail: auth.currentUser.email,
            action,
            details,
            status,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Failed to log admin action:", error);
    }
}
