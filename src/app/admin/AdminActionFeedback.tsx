"use client";

import { useEffect, useState } from "react";

type Feedback = { tone: "loading" | "success" | "error"; text: string };

const PENDING_KEY = "flyero-admin-action-pending";

function labelFor(form: HTMLFormElement, submitter: HTMLElement | null) {
  const text = submitter?.textContent?.replace(/\s+/g, " ").trim();
  return text || form.getAttribute("aria-label") || "Aktion";
}

export function AdminActionFeedback() {
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    const pending = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    const params = new URLSearchParams(window.location.search);
    const error = params.get("message") || (params.get("assignment") === "error" ? "Die Zuweisung konnte nicht gespeichert werden." : null);
    window.setTimeout(() => {
      if (error) {
        setFeedback({ tone: "error", text: error });
      } else if (pending) {
        try {
          const action = JSON.parse(pending) as { label?: string };
          setFeedback({ tone: "success", text: `„${action.label || "Aktion"}“ wurde verarbeitet. Eine Kundeninformation wurde – sofern vorgesehen – zum Versand eingeplant.` });
        } catch {
          setFeedback({ tone: "success", text: "Die Aktion wurde verarbeitet. Eine Kundeninformation wurde – sofern vorgesehen – zum Versand eingeplant." });
        }
      }
    }, 0);

    const onSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const submitter = event.submitter instanceof HTMLElement ? event.submitter : null;
      const label = labelFor(form, submitter);
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ label, createdAt: Date.now() }));
      setFeedback({ tone: "loading", text: `„${label}“ wird verarbeitet …` });
      if (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) {
        submitter.disabled = true;
        submitter.setAttribute("aria-busy", "true");
      }
    };
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, []);

  if (!feedback) return null;
  return (
    <div
      role={feedback.tone === "loading" ? "status" : "alert"}
      aria-live="polite"
      style={{
        position: "fixed", top: 20, right: 20, zIndex: 1000, maxWidth: 440,
        padding: "14px 18px", borderRadius: 12, border: `1px solid ${feedback.tone === "error" ? "#ef9a9a" : "#b7ff21"}`,
        background: feedback.tone === "error" ? "#fff5f5" : "#101713", color: feedback.tone === "error" ? "#7d1d1d" : "#fff",
        boxShadow: "0 12px 34px rgba(16,23,19,.2)", fontSize: 14, lineHeight: 1.45,
      }}
    >
      {feedback.text}
    </div>
  );
}
