
import { useState, useEffect } from "react";

export function CountdownTimer({ hours = 24 }: { hours?: number }) {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    // Para simplificar no demo, o contador reseta a cada 24h a partir do mount
    // Em produção, isso viria do 'expires_at' do banco
    const target = new Date();
    target.setHours(target.getHours() + hours);

    const interval = setInterval(() => {
      const now = new Date();
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft("00:00:00");
        clearInterval(interval);
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [hours]);

  return (
    <span className="font-mono font-bold tracking-wider">
      {timeLeft}
    </span>
  );
}
