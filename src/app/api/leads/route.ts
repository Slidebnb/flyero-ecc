import { ErrorSeverity } from "@prisma/client";
import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { createLead } from "@/lib/leads";
import { createErrorLogFromUnknown } from "@/lib/monitoring";
import { errorResponse, readBody, successResponse } from "@/lib/request";

export async function POST(request: NextRequest) {
  try {
    const lead = await createLead(await readBody(request));

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
      return errorResponse("Bitte pruefe deine Angaben im Kontaktformular.", 400);
    }

    await createErrorLogFromUnknown(error, {
      severity: ErrorSeverity.MEDIUM,
      source: "lead.form",
      fallbackMessage: "Lead Formular Fehler.",
    });
    throw error;
  }
}
