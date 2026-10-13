import { useEffect, useState } from 'react';
import { remainingTime } from '../engine.mjs';
import { Icon } from '../icons';
export function SessionClock({ expiresAt }: { expiresAt: number }) {
  const [seconds, setSeconds] = useState(() => remainingTime(expiresAt));
  useEffect(() => {
    const tick = () => setSeconds(remainingTime(expiresAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  const text = [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
  return (
    <div className="session-timer">
      <div>
        <Icon name="shield" size={22} />
        <span>YOUR PRIVATE SESSION</span>
        <span className="live-dot" />
      </div>
      <strong>{text}</strong>
      <p>Time left to explore</p>
      <div className="timer-track">
        <span style={{ transform: `scaleX(${Math.min(1, seconds / 10800)})` }} />
      </div>
    </div>
  );
}
