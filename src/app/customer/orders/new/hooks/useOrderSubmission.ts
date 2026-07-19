"use client";

import { useCallback, useRef, useState } from "react";

/** Prevents duplicate checkout/inquiry requests from rapid customer clicks. */
export function useOrderSubmission(): {
  isSubmitting: boolean;
  beginSubmission: () => boolean;
  endSubmission: () => void;
} {
  const lockRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const beginSubmission = useCallback(() => {
    if (lockRef.current) return false;
    lockRef.current = true;
    setIsSubmitting(true);
    return true;
  }, []);

  const endSubmission = useCallback(() => {
    lockRef.current = false;
    setIsSubmitting(false);
  }, []);

  return { isSubmitting, beginSubmission, endSubmission };
}
