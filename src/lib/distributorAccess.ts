import { DistributorReviewStatus, UserRole, UserStatus } from "@prisma/client";
import { AuthError } from "@/lib/auth";
import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function requireApprovedDistributor() {
  const session = await requirePermission(Permission.DISTRIBUTOR_OPERATIONS_VIEW);
  if (session.role !== UserRole.DISTRIBUTOR) {
    throw new AuthError("Keine Berechtigung für diese Aktion.", 403);
  }

  const profile = await prisma.distributorProfile.findUnique({
    where: { userId: session.id },
    select: {
      id: true,
      reviewStatus: true,
      user: { select: { status: true } },
    },
  });

  if (!profile || profile.user.status !== UserStatus.ACTIVE || profile.reviewStatus !== DistributorReviewStatus.APPROVED) {
    throw new AuthError("Dein Verteilerkonto ist noch nicht freigegeben.", 403);
  }

  return { session, profile };
}
