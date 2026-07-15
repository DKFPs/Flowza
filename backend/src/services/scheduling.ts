
export interface TimeSlot {
  start: string; // HH:mm
  end: string;   // HH:mm
}

export function isValidTimeSlot(slot: TimeSlot): boolean {
  if (!slot.start || !slot.end) return false;
  
  const [startHour, startMin] = slot.start.split(':').map(Number);
  const [endHour, endMin] = slot.end.split(':').map(Number);
  
  if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) return false;
  
  const startInMinutes = startHour * 60 + startMin;
  const endInMinutes = endHour * 60 + endMin;
  
  // O horário de término deve ser pelo menos 15 minutos após o início
  return endInMinutes >= startInMinutes + 15;
}

export function hasOverlappingSlots(newSlot: TimeSlot, existingSlots: TimeSlot[]): boolean {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  
  const ns = toMin(newSlot.start);
  const ne = toMin(newSlot.end);
  
  return existingSlots.some(es => {
    const s = toMin(es.start);
    const e = toMin(es.end);
    return (ns < e && ne > s);
  });
}
