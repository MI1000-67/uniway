import { useCallback, useEffect, useState } from "react";
import {
  createSession,
  parseSession,
  remainingTime,
  SESSION_KEY,
} from "./session";
import type { VisitorSession } from "./session";

function readStored() {
  try {
    return {
      session: parseSession(sessionStorage.getItem(SESSION_KEY)),
      warning: "",
    };
  } catch {
    return {
      session: null,
      warning:
        "Browser storage is unavailable. Your visitor session will last until this page closes.",
    };
  }
}
export function useVisitorSession() {
  const [initial] = useState(readStored);
  const [session, setSession] = useState<VisitorSession | null>(
    initial.session,
  );
  const [warning, setWarning] = useState(initial.warning);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!session) return;
    const tick = () => {
      setNow(Date.now());
      if (remainingTime(session) === 0) window.clearInterval(timer);
    };
    const timer = window.setInterval(tick, 1000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [session]);
  const activate = useCallback(
    (entranceId: string) => {
      const time = Date.now();
      const next =
        session && remainingTime(session, time) > 0
          ? { ...session, entranceId }
          : createSession(entranceId, time);
      setSession(next);
      setNow(time);
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
        setWarning("");
      } catch {
        setWarning(
          "Browser storage is unavailable. Reloading will end this temporary session.",
        );
      }
      return next;
    },
    [session],
  );
  const remaining = session ? remainingTime(session, now) : 0;
  return {
    session,
    remaining,
    expired: !!session && remaining === 0,
    activate,
    warning,
  };
}
