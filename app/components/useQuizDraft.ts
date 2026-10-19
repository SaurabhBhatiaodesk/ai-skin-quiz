import { useEffect, useRef, useState } from "react";
import type { StoredQuiz } from "../quiz-shared";

// Only merchant quiz configuration is stored here, never shopper photos or API credentials.
export default function useQuizDraft(shop: string, code: string, quiz: StoredQuiz, saved: StoredQuiz) {
  const key = `quiz-draft:${shop}:${code}`;
  const [recovery, setRecovery] = useState<StoredQuiz | null>(null);
  const ready = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.version === 1 && Date.now() - draft.updatedAt < 7 * 86400000 &&
            draft.base === JSON.stringify(saved) && draft.quiz && Array.isArray(draft.quiz.quick) && Array.isArray(draft.quiz.deep)) {
          setRecovery(draft.quiz);
        } else localStorage.removeItem(key);
      }
    } catch { /* Storage can be disabled in embedded browsers. */ }
    ready.current = true;
    // Read recovery once per widget; edits must not reload an older draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (!ready.current || recovery) return;
    const persist = () => {
      try {
        if (JSON.stringify(quiz) === JSON.stringify(saved)) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify({ version: 1, updatedAt: Date.now(), base: JSON.stringify(saved), quiz }));
      } catch { /* Editing and saving still work when local storage is unavailable. */ }
    };
    const timer = setTimeout(persist, 500);
    window.addEventListener("pagehide", persist);
    return () => { clearTimeout(timer); window.removeEventListener("pagehide", persist); };
  }, [key, quiz, saved, recovery]);
  function dismiss() {
    try { localStorage.removeItem(key); } catch { /* Optional recovery only. */ }
    setRecovery(null);
  }
  return { recovery, dismiss };
}
