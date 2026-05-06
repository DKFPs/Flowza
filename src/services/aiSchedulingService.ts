
import { format, parseISO, differenceInMinutes, addMinutes, startOfDay, isAfter, isBefore } from 'date-fns';
import { Appointment, AISettings } from '@/types';

export interface SmartSlot {
  time: string;
  score: number;
  label?: string;
  isAiSuggested: boolean;
  isDiscounted?: boolean;
  discountPercentage?: number;
  isPremium?: boolean;
}

export class AISchedulingService {
  /**
   * Generates available slots considering working hours, service duration, and overlaps.
   */
  static generateAvailableSlots(
    workingHours: { start: string; end: string } = { start: '08:00', end: '18:00' },
    servicesTotalDuration: number,
    existingAppointments: Appointment[],
    intervalMinutes: number = 30,
    bufferMinutes: number = 0,
    breaks?: { start: string; end: string; days?: number[] }[],
    dayOfWeek?: number
  ): string[] {
    const startMins = this.timeToMinutes(workingHours.start);
    const endMins = this.timeToMinutes(workingHours.end);
    const slots: string[] = [];

    const totalBlockSize = servicesTotalDuration + bufferMinutes;

    for (let m = startMins; m <= endMins - totalBlockSize; m += intervalMinutes) {
        const slotStart = m;
        const slotEnd = m + totalBlockSize;

        // Check breaks
        const hasBreakConflict = Array.isArray(breaks) && breaks.some(b => {
            if (b.days && dayOfWeek !== undefined && !b.days.includes(dayOfWeek)) return false;
            const breakStart = this.timeToMinutes(b.start);
            const breakEnd = this.timeToMinutes(b.end);
            return slotStart < breakEnd && slotEnd > breakStart;
        });

        if (hasBreakConflict) continue;

        const hasConflict = Array.isArray(existingAppointments) && existingAppointments.some(apt => {
            if (!apt.start_time) return false;
            const aptStart = this.timeToMinutes(apt.start_time);
            
            // Assume 30 mins fallback if end_time not provided
            const aptEnd = apt.end_time ? this.timeToMinutes(apt.end_time) : aptStart + 30;
            
            return slotStart < aptEnd && slotEnd > aptStart;
        });

        if (!hasConflict) {
            const hh = Math.floor(m / 60).toString().padStart(2, '0');
            const mm = (m % 60).toString().padStart(2, '0');
            slots.push(`${hh}:${mm}`);
        }
    }

    return slots;
  }

  /**
   * Ranks available slots to optimize schedule density and client preferences.
   */
  static rankSlots(
    availableSlots: string[],
    existingAppointments: Appointment[],
    serviceDuration: number,
    settings?: AISettings | null
  ): SmartSlot[] {
    const defaultSettings: AISettings = { 
      enable_smart_slots: true, 
      enable_gap_prevention: true,
      automation_level: 'medium'
    };
    const activeSettings = settings || defaultSettings;

    if (!activeSettings.enable_smart_slots) {
      return availableSlots.map(time => ({ time, score: 0, isAiSuggested: false }));
    }
    
    const totalSlotsForDay = 24; // Approximation
    const occupancyRate = (existingAppointments?.length || 0) / totalSlotsForDay;
    const isBusyDay = occupancyRate > 0.6; // High demand day
    const isSlowDay = occupancyRate < 0.2; // Low demand day

    const ranked: SmartSlot[] = availableSlots.map(slotTime => {
      let score = 0;
      let label = "";
      let isDiscounted = false;
      let discountPercentage = 0;
      let isPremium = false;

      const slotMinutes = this.timeToMinutes(slotTime);
      const slotEndMinutes = slotMinutes + serviceDuration;

      // 1. Density Check: Prioritize slots next to existing appointments
      const isAdjacent = Array.isArray(existingAppointments) && existingAppointments.some(apt => {
        const aptStart = this.timeToMinutes(apt.start_time);
        const aptEnd = this.timeToMinutes(apt.end_time);
        
        return aptEnd === slotMinutes || aptStart === slotEndMinutes;
      });

      if (isAdjacent) {
        score += 50;
        label = "Melhor Ocupação";
      }

      // 2. Gap Prevention
      if (activeSettings.enable_gap_prevention) {
        const leavesSmallGap = Array.isArray(existingAppointments) && existingAppointments.some(apt => {
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

      // 3. Dynamic Pricing & Marketing Logic
      // Peak Hour Weighting
      const isPeakHour = slotMinutes >= 600 && slotMinutes <= 840 || slotMinutes >= 1020 && slotMinutes <= 1140; // 10h-14h and 17h-19h
      
      if (isPeakHour) {
        score += 10;
        if (isBusyDay) {
          isPremium = true;
          label = label || "Alta Demanda";
        }
      } else {
        // Off-peak hours on slow days get discounts to drive conversion
        if (isSlowDay && !isAdjacent) {
          isDiscounted = true;
          discountPercentage = 10; // 10% discount to fill slow days
          label = "Horário Flex";
        }
      }

      return {
        time: slotTime,
        score,
        label: score >= 40 || isDiscounted || isPremium ? label : undefined,
        isAiSuggested: score >= 40 || isDiscounted,
        isDiscounted,
        discountPercentage,
        isPremium
      };
    });

    // Sort by score (descending) and then time (ascending)
    return ranked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.time.localeCompare(b.time);
    });
  }

  private static timeToMinutes(time?: string | null): number {
    if (!time) return 0;
    const parts = time.split(':');
    if (parts.length < 2) return 0;
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
