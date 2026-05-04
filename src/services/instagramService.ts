import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  writeBatch, 
  doc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  orderBy,
  limit
} from "firebase/firestore";
import { InstagramPost, InstagramConfig, Business } from "@/types";

export class InstagramService {
  static async syncPosts(businessId: string, config: InstagramConfig) {
    if (!config.access_token || !config.is_active) return;

    try {
      const response = await fetch(`/api/instagram/sync?accessToken=${config.access_token}&businessId=${businessId}`);
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("OAuthException");
        }
        throw new Error("Failed to sync posts");
      }
      
      const postsData = await response.json();
      
      // Clear old posts and save new ones (simplified cache)
      const q = query(collection(db, "instagram_posts"), where("business_id", "==", businessId));
      const existingSnap = await getDocs(q);
      
      const batch = writeBatch(db);
      
      // Delete old ones
      existingSnap.docs.forEach(d => batch.delete(d.ref));
      
      // Add new ones
      postsData.forEach((post: { media_url: string; media_type: string; permalink: string; caption?: string; timestamp: string }) => {
        const postRef = doc(collection(db, "instagram_posts"));
        batch.set(postRef, {
          business_id: businessId,
          media_url: post.media_url,
          media_type: post.media_type,
          permalink: post.permalink,
          caption: post.caption || "",
          timestamp: post.timestamp,
          created_at: serverTimestamp()
        });
      });
      
      await batch.commit();
      return postsData;
    } catch (error) {
      if (error instanceof Error && error.message === "OAuthException") {
         console.warn("Aviso: Falha de autenticação ao sincronizar Instagram (OAuthException).");
      } else {
         console.error("Error syncing Instagram posts:", error);
      }
      throw error;
    }
  }

  static async getCachedPosts(businessId: string): Promise<InstagramPost[]> {
    if (businessId === "demo-biz") {
      const unsplashIds = [
        "1512756290469-ec419888f4b0", // desk
        "1522071820081-009f0129c71c", // people
        "1497215728101-856f4ea42174", // office
        "1497366216548-37526070297c", // hallway
        "1556761175-5973dc0f32e7", // meeting
        "1504384308090-c894fdcc538d", // coffee laptop
      ];
      return Array.from({ length: 6 }).map((_, i) => ({
        id: `mock_post_${i}`,
        business_id: "demo-biz",
        caption: "Nossas ideias em ação! ✨ #novidades #negocios",
        media_type: "IMAGE",
        media_url: `https://images.unsplash.com/photo-${unsplashIds[i]}?auto=format&fit=crop&w=600&h=600&q=80`,
        permalink: "https://instagram.com",
        timestamp: new Date().toISOString()
      }));
    }

    try {
      const q = query(
        collection(db, "instagram_posts"), 
        where("business_id", "==", businessId),
        orderBy("timestamp", "desc"),
        limit(12)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as InstagramPost));
    } catch (error) {
      console.error("Error fetching cached Instagram posts:", error);
      return [];
    }
  }

  static async disconnect(businessId: string) {
    try {
      const businessRef = doc(db, "businesses", businessId);
      await updateDoc(businessRef, {
        "instagram_config.is_active": false,
        "instagram_config.access_token": ""
      });
      
      // Delete cached posts
      const q = query(collection(db, "instagram_posts"), where("business_id", "==", businessId));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    } catch (error) {
      console.error("Error disconnecting Instagram:", error);
      throw error;
    }
  }
}
