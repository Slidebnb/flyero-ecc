import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { createSystemLog } from "@/lib/monitoring";

export type EmailProvider = "mock" | "smtp" | "resend";

export type EmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  metadata?: Record<string, unknown>;
};

export type EmailResult = {
  provider: EmailProvider;
  messageId: string;
  accepted: string[];
};

function provider(): EmailProvider {
  const value = (process.env.EMAIL_PROVIDER || "mock").toLowerCase();
  if (value === "smtp" || value === "resend") return value;
  return "mock";
}

function fromAddress() {
  return process.env.EMAIL_FROM || process.env.SMTP_FROM || "hallo@flyero.org";
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} ist nicht gesetzt.`);
  return value;
}

function sanitizeForLog(input: EmailInput) {
  return JSON.parse(JSON.stringify({
    to: input.to,
    subject: input.subject,
    provider: provider(),
    hasHtml: Boolean(input.html),
    metadata: input.metadata ?? null,
  })) as Prisma.InputJsonValue;
}

async function sendMockEmail(input: EmailInput): Promise<EmailResult> {
  const hash = createHash("sha256")
    .update(`${input.to}:${input.subject}:${Date.now()}`)
    .digest("hex")
    .slice(0, 24);

  await createSystemLog({
    source: "email.mock",
    message: `Mock E-Mail an ${input.to}`,
    metadata: sanitizeForLog(input),
  });

  return {
    provider: "mock",
    messageId: `mock_${hash}`,
    accepted: [input.to],
  };
}

async function sendSmtpEmail(input: EmailInput): Promise<EmailResult> {
  const host = requireEnv("SMTP_HOST");
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const from = fromAddress();
  const net = await import("node:net");
  const tls = await import("node:tls");

  let socket = port === 465
    ? tls.connect({ host, port, servername: host })
    : net.createConnection({ host, port });

  const read = () => new Promise<string>((resolve, reject) => {
    socket.once("data", (chunk) => resolve(chunk.toString("utf8")));
    socket.once("error", reject);
  });
  const write = async (command: string) => {
    socket.write(command);
    return read();
  };
  const assertOk = (response: string, expected: RegExp, label: string) => {
    if (!expected.test(response)) throw new Error(`SMTP ${label} fehlgeschlagen.`);
  };

  try {
    assertOk(await read(), /^220/, "connect");
    const ehloResponse = await write(`EHLO flyero.local\r\n`);
    assertOk(ehloResponse, /^250/, "ehlo");

    if (port !== 465 && /STARTTLS/im.test(ehloResponse) && process.env.SMTP_DISABLE_STARTTLS !== "true") {
      assertOk(await write("STARTTLS\r\n"), /^220/, "starttls");
      socket = tls.connect({ socket, servername: host });
      await new Promise<void>((resolve, reject) => {
        socket.once("secureConnect", resolve);
        socket.once("error", reject);
      });
      assertOk(await write(`EHLO flyero.local\r\n`), /^250/, "ehlo-starttls");
    }

    if (user && pass) {
      assertOk(await write("AUTH LOGIN\r\n"), /^334/, "auth");
      assertOk(await write(`${Buffer.from(user).toString("base64")}\r\n`), /^334/, "user");
      assertOk(await write(`${Buffer.from(pass).toString("base64")}\r\n`), /^235/, "pass");
    }

    assertOk(await write(`MAIL FROM:<${from}>\r\n`), /^250/, "mail-from");
    assertOk(await write(`RCPT TO:<${input.to}>\r\n`), /^(250|251)/, "rcpt-to");
    assertOk(await write("DATA\r\n"), /^354/, "data");

    const boundary = `flyero-${Date.now()}`;
    const html = input.html || input.text.replace(/\n/g, "<br />");
    const message = [
      `From: ${from}`,
      `To: ${input.to}`,
      `Subject: ${input.subject}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      input.text,
      "",
      `--${boundary}`,
      "Content-Type: text/html; charset=utf-8",
      "",
      html,
      "",
      `--${boundary}--`,
      ".",
      "",
    ].join("\r\n");

    assertOk(await write(message), /^250/, "send");
    socket.write("QUIT\r\n");
  } finally {
    socket.end();
  }

  await createSystemLog({
    source: "email.smtp",
    message: `SMTP E-Mail an ${input.to}`,
    metadata: sanitizeForLog(input),
  });

  return {
    provider: "smtp",
    messageId: `smtp_${Date.now()}`,
    accepted: [input.to],
  };
}

async function sendResendEmail(input: EmailInput): Promise<EmailResult> {
  const apiKey = requireEnv("RESEND_API_KEY");
  const controller = new AbortController();
  const timeoutMs = Math.max(2_000, Number(process.env.EMAIL_SEND_TIMEOUT_MS || 10_000));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Resend Versand fehlgeschlagen: ${response.status}`);
  }

  const data = await response.json() as { id?: string };
  await createSystemLog({
    source: "email.resend",
    message: `Resend E-Mail an ${input.to}`,
    metadata: sanitizeForLog(input),
  });

  return {
    provider: "resend",
    messageId: data.id || `resend_${Date.now()}`,
    accepted: [input.to],
  };
}

export async function sendEmail(input: EmailInput) {
  const selected = provider();
  if (selected === "smtp") return sendSmtpEmail(input);
  if (selected === "resend") return sendResendEmail(input);
  return sendMockEmail(input);
}

export function getEmailProviderStatus() {
  const selected = provider();
  return {
    provider: selected,
    from: fromAddress(),
    smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM),
    resendConfigured: Boolean(process.env.RESEND_API_KEY),
  };
}
