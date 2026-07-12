import { createVerificationToken, hashVerificationToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

export async function createPasswordResetToken(userId: string) {
  const token = createVerificationToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MS);

  const created = await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: now },
    });

    return tx.passwordResetToken.create({
      data: { userId, tokenHash: hashVerificationToken(token), expiresAt },
      select: { id: true, expiresAt: true },
    });
  });

  return { token, tokenId: created.id, expiresAt: created.expiresAt };
}

export async function invalidatePasswordResetToken(tokenId: string) {
  await prisma.passwordResetToken.updateMany({ where: { id: tokenId, usedAt: null }, data: { usedAt: new Date() } });
}
