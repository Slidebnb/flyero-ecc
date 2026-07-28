import { createVerificationToken, hashVerificationToken } from "@/lib/auth";
import { buildCustomerEmail } from "./customerEmailTemplate.ts";
import { sendEmail } from "@/lib/email";
import { publicUrl } from "@/lib/publicUrl";
import { prisma } from "@/lib/prisma";
import { safeInternalRedirectPath } from "@/lib/redirects";

const VERIFICATION_TOKEN_TTL_MS = 1000 * 60 * 60 * 24;

export async function createEmailVerificationToken(userId: string, redirectPath?: string) {
  const verificationToken = createVerificationToken();
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
  const safeRedirectPath = safeInternalRedirectPath(redirectPath, "");

  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: hashVerificationToken(verificationToken),
      expiresAt,
      redirectPath: safeRedirectPath || null,
    },
  });

  return { verificationToken, expiresAt };
}

export async function sendVerificationEmail({
  email,
  token,
  requestUrl,
}: {
  email: string;
  token: string;
  requestUrl: string;
}) {
  const verifyUrl = publicUrl(`/verify-email?token=${encodeURIComponent(token)}`, requestUrl).toString();
  const customerEmail = buildCustomerEmail({
    subject: "Ihre FLYERO-E-Mail-Adresse best\u00e4tigen",
    eyebrow: "KONTO AKTIVIEREN",
    title: "Best\u00e4tigen Sie Ihre E-Mail-Adresse",
    intro: "Willkommen bei FLYERO. Best\u00e4tigen Sie Ihre E-Mail-Adresse, damit Ihr Konto aktiviert wird.",
    action: { label: "E-Mail-Adresse best\u00e4tigen", url: verifyUrl },
    note: "Falls Sie diese Registrierung nicht gestartet haben, k\u00f6nnen Sie diese E-Mail ignorieren.",
  });

  return sendEmail({
    to: email,
    subject: customerEmail.subject,
    text: customerEmail.text,
    html: customerEmail.html,
    metadata: { type: "email_verification" },
  });
}

export async function sendPasswordResetEmail({
  email,
  token,
  requestUrl,
}: {
  email: string;
  token: string;
  requestUrl: string;
}) {
  const resetUrl = publicUrl(`/reset-password?token=${encodeURIComponent(token)}`, requestUrl).toString();
  const customerEmail = buildCustomerEmail({
    subject: "Ihr FLYERO-Passwort zur\u00fccksetzen",
    eyebrow: "KONTO SICHERN",
    title: "Neues Passwort festlegen",
    intro: "Sie haben das Zur\u00fccksetzen Ihres FLYERO-Passworts angefordert.",
    action: { label: "Neues Passwort festlegen", url: resetUrl },
    note: "Der Link ist 30 Minuten g\u00fcltig. Falls Sie diese Anfrage nicht gestellt haben, m\u00fcssen Sie nichts tun.",
  });

  return sendEmail({
    to: email,
    subject: customerEmail.subject,
    text: customerEmail.text,
    html: customerEmail.html,
    metadata: { type: "password_reset" },
  });
}
