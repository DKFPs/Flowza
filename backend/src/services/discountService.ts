
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  Timestamp,
  limit
} from "firebase/firestore";
import { handleFirestoreError, OperationType } from "@/lib/firestoreUtils";

export interface Discount {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  expires_at?: Timestamp;
  max_uses?: number;
  current_uses: number;
  is_active: boolean;
}

export interface UserOffer {
  id: string;
  user_id: string;
  discount_id: string;
  trigger: 'activation' | 'inactivity' | 'limit_reached';
  expires_at: Timestamp;
  is_used: boolean;
  code: string; // denormalized for easier access
}

export const DiscountService = {
  // Busca um cupom global pelo código
  async validateCoupon(code: string): Promise<Discount | null> {
    const uppercaseCode = code.trim().toUpperCase();

    try {
      const q = query(
        collection(db, "discounts"), 
        where("code", "==", uppercaseCode),
        where("is_active", "==", true),
        limit(1)
      );
      const snap = await getDocs(q);
      
      if (snap.empty) return null;
      
      const data = snap.docs[0].data() as Discount;
      const discount = { ...data, id: snap.docs[0].id };

      // Verificar expiração
      if (discount.expires_at && discount.expires_at.toDate() < new Date()) return null;
      
      // Verificar limite de uso
      if (discount.max_uses && discount.current_uses >= discount.max_uses) return null;

      return discount;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, "discounts");
      return null;
    }
  },

  // Busca ofertas personalizadas ativas para o usuário
  async getUserOffers(userId: string): Promise<UserOffer[]> {
    try {
      const q = query(
        collection(db, "user_offers"),
        where("user_id", "==", userId),
        where("is_used", "==", false),
        where("expires_at", ">", new Date())
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as UserOffer));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, "user_offers");
      return [];
    }
  },

  // Registra uma nova oferta (Gatilho)
  async createOffer(userId: string, discountId: string, code: string, trigger: UserOffer['trigger'], daysValid: number = 1) {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + daysValid);

      await addDoc(collection(db, "user_offers"), {
        user_id: userId,
        discount_id: discountId,
        code,
        trigger,
        expires_at: Timestamp.fromDate(expiresAt),
        is_used: false,
        created_at: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "user_offers");
    }
  }
};
