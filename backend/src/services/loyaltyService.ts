import { 
  collection, 
  doc, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  serverTimestamp, 
  increment, 
  getDoc,
  limit,
  Timestamp,
  writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Appointment, 
  LoyaltyConfig, 
  LoyaltyLevel, 
  LoyaltyMission, 
  ClientMissionProgress 
} from "@shared/types";
import { handleFirestoreError, OperationType } from "@/lib/firestoreUtils";

export const LoyaltyService = {
  /**
   * Award points to a client based on a completed appointment
   */
  async awardPointsForAppointment(appointment: Appointment) {
    if (appointment.status !== 'completed') return;

    try {
      // 1. Get Loyalty Config for this business
      const configQuery = query(collection(db, "loyalty_configs"), where("business_id", "==", appointment.business_id), limit(1));
      const configSnap = await getDocs(configQuery);
      
      if (configSnap.empty) return;
      const config = configSnap.docs[0].data() as LoyaltyConfig;
      if (!config.is_enabled) return;

      // 2. Calculate points
      const price = appointment.services?.price || 0;
      let pointsToAward = Math.floor(price * (config.points_per_brl || 1));
      
      // Add recurring visit bonus if configured
      if (config.recurring_visit_bonus && config.recurring_visit_bonus > 0) {
        pointsToAward += config.recurring_visit_bonus;
      }

      if (pointsToAward <= 0) return;

      // 3. Add point record
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + (config.point_expiration_days || 90));

      await addDoc(collection(db, "loyalty_points"), {
        business_id: appointment.business_id,
        client_id: appointment.client_id,
        points: pointsToAward,
        source: 'appointment',
        reference_id: appointment.id,
        expires_at: Timestamp.fromDate(expirationDate),
        created_at: serverTimestamp()
      });

      // 4. Update total points
      const pointsTotalQuery = query(
        collection(db, "loyalty_balances"), 
        where("business_id", "==", appointment.business_id),
        where("client_id", "==", appointment.client_id),
        limit(1)
      );
      const balanceSnap = await getDocs(pointsTotalQuery);

      if (balanceSnap.empty) {
        await addDoc(collection(db, "loyalty_balances"), {
          business_id: appointment.business_id,
          client_id: appointment.client_id,
          balance: pointsToAward,
          total_earned: pointsToAward,
          updated_at: serverTimestamp()
        });
      } else {
        await updateDoc(doc(db, "loyalty_balances", balanceSnap.docs[0].id), {
          balance: increment(pointsToAward),
          total_earned: increment(pointsToAward),
          updated_at: serverTimestamp()
        });
      }

      // 5. Update missions & levels
      await this.updateMissionProgress(appointment.business_id, appointment.client_id, 'appointment');
      await this.checkLevelUpgrade(appointment.business_id, appointment.client_id);

    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "loyalty_award_points");
    }
  },

  /**
   * Update progress for active missions
   */
  async updateMissionProgress(businessId: string, clientId: string, type: 'appointment') {
    try {
      const missionsQuery = query(
        collection(db, "loyalty_missions"), 
        where("business_id", "==", businessId),
        where("is_active", "==", true)
      );
      const missionsSnap = await getDocs(missionsQuery);

      for (const missionDoc of missionsSnap.docs) {
        const mission = { id: missionDoc.id, ...missionDoc.data() } as LoyaltyMission;
        
        // Find existing progress
        const progressQuery = query(
          collection(db, "loyalty_mission_progress"),
          where("mission_id", "==", mission.id),
          where("client_id", "==", clientId),
          limit(1)
        );
        const progressSnap = await getDocs(progressQuery);

        if (progressSnap.empty) {
          await addDoc(collection(db, "loyalty_mission_progress"), {
            mission_id: mission.id,
            client_id: clientId,
            business_id: businessId,
            current_value: 1,
            is_completed: 1 >= mission.target,
            completed_at: 1 >= mission.target ? serverTimestamp() : null
          });
          
          if (1 >= mission.target) {
            await this.awardBonusPoints(businessId, clientId, mission.reward_points, `mission_${mission.id}`);
          }
        } else {
          const progressDoc = progressSnap.docs[0];
          const progress = progressDoc.data() as ClientMissionProgress;
          
          if (progress.is_completed) continue;

          const newValue = progress.current_value + 1;
          const isCompleted = newValue >= mission.target;

          await updateDoc(doc(db, "loyalty_mission_progress", progressDoc.id), {
            current_value: increment(1),
            is_completed: isCompleted,
            completed_at: isCompleted ? serverTimestamp() : null
          });

          if (isCompleted) {
            await this.awardBonusPoints(businessId, clientId, mission.reward_points, `mission_${mission.id}`);
          }
        }
      }
    } catch (error) {
      console.error("Error updating mission progress:", error);
    }
  },

  /**
   * Award bonus points (manually or via mission/first visit)
   */
  async awardBonusPoints(businessId: string, clientId: string, points: number, referenceId: string) {
    if (points <= 0) return;

    await addDoc(collection(db, "loyalty_points"), {
      business_id: businessId,
      client_id: clientId,
      points: points,
      source: 'bonus',
      reference_id: referenceId,
      created_at: serverTimestamp()
    });

    const balanceQuery = query(
      collection(db, "loyalty_balances"), 
      where("business_id", "==", businessId),
      where("client_id", "==", clientId),
      limit(1)
    );
    const balanceSnap = await getDocs(balanceQuery);

    if (balanceSnap.empty) {
      await addDoc(collection(db, "loyalty_balances"), {
        business_id: businessId,
        client_id: clientId,
        balance: points,
        total_earned: points,
        updated_at: serverTimestamp()
      });
    } else {
      await updateDoc(doc(db, "loyalty_balances", balanceSnap.docs[0].id), {
        balance: increment(points),
        total_earned: increment(points),
        updated_at: serverTimestamp()
      });
    }
  },

  /**
   * Award registration points for new clients
   */
  async awardRegistrationPoints(businessId: string, clientId: string) {
    try {
      const configQuery = query(collection(db, "loyalty_configs"), where("business_id", "==", businessId), limit(1));
      const configSnap = await getDocs(configQuery);
      
      if (configSnap.empty) return;
      const config = configSnap.docs[0].data() as LoyaltyConfig;
      if (!config.is_enabled) return;

      if (config.registration_bonus && config.registration_bonus > 0) {
        await this.awardBonusPoints(businessId, clientId, config.registration_bonus, 'registration_bonus');
      }
    } catch (e) {
      console.error("Error awarding registration bonus", e);
    }
  },

  /**
   * Check if client should level up
   */
  async checkLevelUpgrade(businessId: string, clientId: string) {
    try {
      // Get total earned points
      const balanceQuery = query(
        collection(db, "loyalty_balances"), 
        where("business_id", "==", businessId),
        where("client_id", "==", clientId),
        limit(1)
      );
      const balanceSnap = await getDocs(balanceQuery);
      if (balanceSnap.empty) return;
      
      const totalEarned = balanceSnap.docs[0].data().total_earned || 0;

      // Get levels
      const levelsQuery = query(
        collection(db, "loyalty_levels"),
        where("business_id", "==", businessId)
      );
      const levelsSnap = await getDocs(levelsQuery);
      
      let currentBestLevel: LoyaltyLevel | null = null;
      for (const levelDoc of levelsSnap.docs) {
        const level = { id: levelDoc.id, ...levelDoc.data() } as LoyaltyLevel;
        if (totalEarned >= level.min_points) {
          if (!currentBestLevel || level.min_points > currentBestLevel.min_points) {
            currentBestLevel = level;
          }
        }
      }

      if (currentBestLevel) {
        await updateDoc(doc(db, "clients", clientId), {
          loyalty_level_id: currentBestLevel.id,
          loyalty_level_name: currentBestLevel.name
        });
      }
    } catch (error) {
       console.error("Error checking level upgrade:", error);
    }
  },

  /**
   * Generate redemption code
   */
  generateRedemptionCode(currencyName: string | undefined, businessName: string): string {
    let cleanName = "";
    if (currencyName && currencyName.trim() !== "") {
      cleanName = currencyName.toUpperCase().replace(/[^A-Z]/g, '');
    } else {
      cleanName = businessName.toUpperCase().replace(/\s/g, '').substring(0, 6);
    }
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${cleanName}${rand}`;
  }
};
