
export function calculatePoints(value: number): number {
  if (!value || value <= 0) return 0;
  // Regra: 1 ponto a cada R$ 10,00
  return Math.floor(value / 10);
}

export function generateRewardCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `RW-${code}`;
}
