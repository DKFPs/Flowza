
// src/core/loyalty/loyaltyService.ts
export interface LoyaltyConfig {
  pointsPerDollar: number;
}

export function calculateServicePoints(price: number, config: LoyaltyConfig = { pointsPerDollar: 1 }): number {
  if (price <= 0) return 0;
  return Math.floor(price * config.pointsPerDollar);
}

export function generateRewardCode(customerName: string): string {
  const prefix = customerName.substring(0, 3).toUpperCase();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${random}`;
}

// src/core/appointments/appointmentRules.ts
export interface TimeSlot {
  start: Date;
  end: Date;
}

export function isOverlapping(slot1: TimeSlot, slot2: TimeSlot): boolean {
  return slot1.start < slot2.end && slot1.end > slot2.start;
}

export function shouldBlacklist(cancelCount: number): boolean {
  return cancelCount >= 3;
}

// src/core/appointments/recurrence.ts
export function generateRecurringSeries(
  firstStart: Date, 
  firstEnd: Date, 
  weeks: number
): TimeSlot[] {
  const series: TimeSlot[] = [];
  for (let i = 0; i < weeks; i++) {
    const start = new Date(firstStart);
    const end = new Date(firstEnd);
    start.setDate(start.getDate() + (i * 7));
    end.setDate(end.getDate() + (i * 7));
    series.push({ start, end });
  }
  return series;
}
