import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

export type FileScanMode = "required" | "optional" | "disabled";
export type FileScanStatus = "PENDING" | "CLEAN" | "INFECTED" | "ERROR" | "NOT_CONFIGURED";

type ScanConfigurationInput = {
  mode?: string;
  clamscanPath?: string;
};

function normalizeMode(value?: string): FileScanMode {
  if (value === "required" || value === "disabled") return value;
  return "optional";
}

export function scanConfiguration(input: ScanConfigurationInput = {}) {
  const mode = normalizeMode(input.mode ?? process.env.FILE_SCAN_MODE);
  const clamscanPath = (input.clamscanPath ?? process.env.CLAMSCAN_PATH ?? "").trim();
  return {
    mode,
    clamscanPath,
    scannerConfigured: Boolean(clamscanPath),
    provider: clamscanPath ? "clamav" : mode === "disabled" ? "disabled" : "none",
  } as const;
}

export function scanStatusForConfiguration(input: { mode: string; scannerConfigured: boolean }) {
  const mode = normalizeMode(input.mode);
  if (mode === "disabled") return { status: "NOT_CONFIGURED" as const, provider: "disabled" };
  if (!input.scannerConfigured) return { status: mode === "required" ? "ERROR" as const : "NOT_CONFIGURED" as const, provider: "none" };
  return { status: "PENDING" as const, provider: "clamav" };
}

export function requiresCleanScan(input: { mode: string; status: FileScanStatus }) {
  const mode = normalizeMode(input.mode);
  if (input.status === "CLEAN") return false;
  if (mode === "disabled") return false;
  if (input.status === "INFECTED" || input.status === "ERROR" || input.status === "PENDING") return true;
  return mode === "required";
}

function outputMessage(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 500) || null;
}

function executeClamScan(command: string, filePath: string) {
  return new Promise<{ code: number; output: string }>((resolve, reject) => {
    const child = spawn(command, ["--no-summary", "--infected", filePath], { shell: false, windowsHide: true });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? -1, output }));
  });
}

export async function scanFileBuffer(input: { buffer: Buffer; originalFilename: string }) {
  const configuration = scanConfiguration();
  const configured = scanStatusForConfiguration(configuration);
  if (!configuration.scannerConfigured) {
    return { ...configured, mode: configuration.mode, message: configuration.mode === "required" ? "ClamAV ist nicht konfiguriert." : "Kein Malware-Scanner konfiguriert." };
  }

  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "flyero-file-scan-"));
  const safeFilename = path.basename(input.originalFilename).replace(/[^a-zA-Z0-9._-]/g, "_") || randomUUID();
  const temporaryFile = path.join(temporaryDirectory, safeFilename);
  try {
    await writeFile(temporaryFile, input.buffer, { flag: "wx" });
    const result = await executeClamScan(configuration.clamscanPath, temporaryFile);
    if (result.code === 0) return { status: "CLEAN" as const, provider: "clamav", mode: configuration.mode, message: null };
    if (result.code === 1) return { status: "INFECTED" as const, provider: "clamav", mode: configuration.mode, message: outputMessage(result.output) || "ClamAV hat eine Bedrohung erkannt." };
    return { status: "ERROR" as const, provider: "clamav", mode: configuration.mode, message: outputMessage(result.output) || `ClamAV beendet sich mit Code ${result.code}.` };
  } catch (error) {
    return { status: "ERROR" as const, provider: "clamav", mode: configuration.mode, message: outputMessage(error instanceof Error ? error.message : "ClamAV konnte nicht ausgeführt werden.") };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export function approvalRequiresCleanScan(input: { mode?: string; status: FileScanStatus }) {
  const mode = normalizeMode(input.mode ?? process.env.FILE_SCAN_MODE);
  if (input.status === "CLEAN") return false;
  if (input.status === "INFECTED" || input.status === "ERROR" || input.status === "PENDING") return true;
  return mode === "required";
}
