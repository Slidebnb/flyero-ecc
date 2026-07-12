import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function positiveDays(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

const now = new Date();
const applyRequested = process.argv.includes("--apply");
const applyEnabled = process.env.RETENTION_APPLY === "true";
const apply = applyRequested && applyEnabled;
const verificationTokenDays = positiveDays("RETENTION_VERIFICATION_TOKEN_DAYS", 7);
const sessionDays = positiveDays("RETENTION_SESSION_DAYS", 30);
const rateLimitBucketDays = positiveDays("RETENTION_RATE_LIMIT_BUCKET_DAYS", 7);

const verificationCutoff = new Date(now.getTime() - verificationTokenDays * 24 * 60 * 60 * 1000);
const sessionCutoff = new Date(now.getTime() - sessionDays * 24 * 60 * 60 * 1000);
const rateLimitCutoff = new Date(now.getTime() - rateLimitBucketDays * 24 * 60 * 60 * 1000);

const verificationWhere = {
  OR: [
    { expiresAt: { lt: now } },
    { usedAt: { not: null }, createdAt: { lt: verificationCutoff } },
  ],
};
const sessionWhere = {
  OR: [
    { expiresAt: { lt: now } },
    { revokedAt: { not: null }, createdAt: { lt: sessionCutoff } },
  ],
};
const rateLimitWhere = { updatedAt: { lt: rateLimitCutoff } };

try {
  const [verificationTokens, sessions, rateLimitBuckets, publicRateLimitBuckets] = await Promise.all([
    prisma.emailVerificationToken.count({ where: verificationWhere }),
    prisma.authSession.count({ where: sessionWhere }),
    prisma.authRateLimitBucket.count({ where: rateLimitWhere }),
    prisma.publicRateLimitBucket.count({ where: rateLimitWhere }),
  ]);

  const result = {
    mode: apply ? "apply" : "dry-run",
    generatedAt: now.toISOString(),
    policy: {
      verificationTokenDays,
      sessionDays,
      rateLimitBucketDays,
    },
    candidates: { verificationTokens, sessions, rateLimitBuckets, publicRateLimitBuckets },
    deleted: { verificationTokens: 0, sessions: 0, rateLimitBuckets: 0, publicRateLimitBuckets: 0 },
    skipped: ["GpsPoint", "PhotoProof", "Document", "AuditLog", "Invoice"],
  };

  if (applyRequested && !applyEnabled) {
    throw new Error("Purge verlangt RETENTION_APPLY=true. Ohne diese Variable bleibt der Lauf ein Dry-Run.");
  }

  if (apply) {
    const deleted = await prisma.$transaction([
      prisma.emailVerificationToken.deleteMany({ where: verificationWhere }),
      prisma.authSession.deleteMany({ where: sessionWhere }),
      prisma.authRateLimitBucket.deleteMany({ where: rateLimitWhere }),
      prisma.publicRateLimitBucket.deleteMany({ where: rateLimitWhere }),
    ]);
    result.deleted = {
      verificationTokens: deleted[0].count,
      sessions: deleted[1].count,
      rateLimitBuckets: deleted[2].count,
      publicRateLimitBuckets: deleted[3].count,
    };
  }

  console.log(JSON.stringify(result, null, 2));
} finally {
  await prisma.$disconnect();
}
