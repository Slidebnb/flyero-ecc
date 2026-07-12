import { createVerificationToken, hashVerificationToken } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { publicUrl } from "@/lib/publicUrl";
import { prisma } from "@/lib/prisma";

const VERIFICATION_TOKEN_TTL_MS = 1000 * 60 * 60 * 24;

export async function createEmailVerificationToken(userId: string) {
  const verificationToken = createVerificationToken();
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: hashVerificationToken(verificationToken),
      expiresAt,
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

  return sendEmail({
    to: email,
    subject: "FLYERO E-Mail bestätigen",
    text: [
      "Willkommen bei FLYERO.",
      "",
      "Bitte bestätigen Sie Ihre E-Mail-Adresse, damit Ihr Konto aktiviert wird:",
      verifyUrl,
      "",
      "Falls Sie diese Registrierung nicht gestartet haben, können Sie diese E-Mail ignorieren.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827">
        <h1 style="margin:0 0 12px">E-Mail bestätigen</h1>
        <p>Willkommen bei <strong>FLYERO</strong>. Bitte bestätigen Sie Ihre E-Mail-Adresse, damit Ihr Konto aktiviert wird.</p>
        <p style="margin:24px 0">
          <a href="${verifyUrl}" style="background:#b7ff00;color:#111827;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:700">E-Mail bestätigen</a>
        </p>
        <p style="color:#4b5563">Falls der Button nicht funktioniert, kopieren Sie diesen Link in den Browser:<br />${verifyUrl}</p>
      </div>
    `,
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

  return sendEmail({
    to: email,
    subject: "FLYERO Passwort zurücksetzen",
    text: [
      "Sie haben das Zurücksetzen Ihres FLYERO-Passworts angefordert.",
      "",
      "Öffnen Sie diesen Link, um ein neues Passwort festzulegen:",
      resetUrl,
      "",
      "Der Link ist 30 Minuten gültig. Wenn Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827">
        <h1 style="margin:0 0 12px">Passwort zurücksetzen</h1>
        <p>Sie haben das Zurücksetzen Ihres <strong>FLYERO</strong>-Passworts angefordert.</p>
        <p style="margin:24px 0">
          <a href="${resetUrl}" style="background:#b7ff00;color:#111827;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:700">Neues Passwort festlegen</a>
        </p>
        <p style="color:#4b5563">Der Link ist 30 Minuten gültig. Falls Sie die Anfrage nicht gestellt haben, müssen Sie nichts tun.</p>
      </div>
    `,
    metadata: { type: "password_reset" },
  });
}
