
import { format, parseISO, differenceInMinutes, addMinutes, startOfDay, isAfter, isBefore } from 'date-fns';
import { Appointment, AISettings } from '@/types';

export interface SmartSlot {
  time: string;
  score: number;
  label?: string;
  isAiSuggested: boolean;
}

export class AISchedulingService {
  /**
   * Ranks available slots to optimize schedule density and client preferences.
   */
  static rankSlots(
    availableSlots: string[],
    existingAppointments: Appointment[],
    serviceDuration: number,
    settings: AISettings = { 
      enable_smart_slots: true, 
      enable_gap_prevention: true,
      automation_level: 'medium'
    }
  ): SmartSlot[] {
    if (!settings.enable_smart_slots) {
      return availableSlots.map(time => ({ time, score: 0, isAiSuggested: false }));
    }

    const ranked: SmartSlot[] = availableSlots.map(slotTime => {
      let score = 0;
      let label = "";

      const slotMinutes = this.timeToMinutes(slotTime);
      const slotEndMinutes = slotMinutes + serviceDuration;

      // 1. Density Check: Prioritize slots next to existing appointments
      const isAdjacent = existingAppointments.some(apt => {
        const aptStart = this.timeToMinutes(apt.start_time);
        const aptEnd = this.timeToMinutes(apt.end_time);
        
        return aptEnd === slotMinutes || aptStart === slotEndMinutes;
      });

      if (isAdjacent) {
        score += 50;
        label = "Melhor Ocupação";
      }

      // 2. Gap Prevention
      if (settings.enable_gap_prevention) {
        const leavesSmallGap = existingAppointments.some(apt => {
          const aptStart = this.timeToMinutes(apt.start_time);
          const aptEnd = this.timeToMinutes(apt.end_time);

          // Gap between end of this slot and start of next apt
          const gapAfter = aptStart - slotEndMinutes;
          // Gap between end of prev apt and start of this slot
          const gapBefore = slotMinutes - aptEnd;

          // If gap is less than 30 mins but > 0, it's a "bad" gap
          const isBadGap = (gapAfter > 0 && gapAfter < 30) || (gapBefore > 0 && gapBefore < 30);
          return isBadGap;
        });

        if (leavesSmallGap) {
          score -= 30;
        }
      }

      // 3. Peak Hour Weighting (Business Logic)
      if (slotMinutes >= 600 && slotMinutes <= 840) { // 10h to 14h
        score += 10;
      }

      return {
        time: slotTime,
        score,
        label: score >= 40 ? label : undefined,
        isAiSuggested: score >= 40
      };
    });

    // Sort by score (descending) and then time (ascending)
    return ranked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.time.localeCompare(b.time);
    });
  }

  private static timeToMinutes(time: string): number {
    if (!time) return 0;
    const parts = time.split(':');
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }

  /**
   * Simple logic to identify clients for re-engagement
   */
  static getClientsToReengage(appointments: Appointment[], daysInactivity = 30): string[] {
    const now = new Date();
    const lastAptByClient: Record<string, Date> = {};

    appointments.forEach(apt => {
      if (!apt.appointment_date || !apt.client_id) return;
      
      const date = parseISO(apt.appointment_date);
      if (isNaN(date.getTime())) return;

      if (!lastAptByClient[apt.client_id] || isAfter(date, lastAptByClient[apt.client_id])) {
        lastAptByClient[apt.client_id] = date;
      }
    });

    return Object.entries(lastAptByClient)
      .filter(([_, lastDate]) => {
        if (isNaN(lastDate.getTime())) return false;
        const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= daysInactivity;
      })
      .map(([clientId]) => clientId);
  }
}
