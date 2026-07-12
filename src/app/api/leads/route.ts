import { ErrorSeverity } from "@prisma/client";
import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { assertLeadSubmissionAllowed } from "@/lib/abuseProtection";
import { createLead } from "@/lib/leads";
import { createErrorLogFromUnknown } from "@/lib/monitoring";
import { publicRateLimitResponse } from "@/lib/publicAbuseProtection";
import { errorResponse, readBody, successResponse } from "@/lib/request";

export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request);
    const abuseDecision = await assertLeadSubmissionAllowed(request, body);
    if (!abuseDecision.allowed) {
      if (abuseDecision.reason === "honeypot") {
        return successResponse({ id: null, status: "IGNORED", message: "Danke, wir haben deine Anfrage erhalten." }, 202);
      }
      return publicRateLimitResponse(abuseDecision);
    }

    const lead = await createLead(body);

    return successResponse(
      {
        id: lead.id,
        status: lead.status,
        message: "Danke, wir haben deine Anfrage erhalten.",
      },
      201,
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse("Bitte prüfe deine Angaben im Kontaktformular.", 400);
    }

    await createErrorLogFromUnknown(error, {
      severity: ErrorSeverity.MEDIUM,
      source: "lead.form",
      fallbackMessage: "Lead Formular Fehler.",
    });
    throw error;
  }
}
