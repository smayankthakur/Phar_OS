import nodemailer from "nodemailer";
import { Prisma } from "@pharos/db";
import { prisma } from "@/lib/prisma";
import { logTelemetry } from "@/lib/telemetry";

export type NotificationMode = "DRY_RUN" | "LIVE";

export function notifyEnabled() {
  return process.env.PHAROS_NOTIFY !== "0";
}

export function parseRecipients(value: string | null | undefined) {
  if (!value) return [] as string[];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 3);
}

export function maskWebhookUrl(rawUrl: string | null | undefined) {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return "invalid-url";
  }
}

export function parseNotificationMode(value: string | null | undefined): NotificationMode {
  if (value === "LIVE") return "LIVE";
  return "DRY_RUN";
}

export async function ensureWorkspaceNotificationSettings(workspaceId: string) {
  return prisma.workspaceNotificationSettings.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      notifyMode: "DRY_RUN",
    },
    update: {},
  });
}

export async function getNotificationSettings(workspaceId: string) {
  const settings = await ensureWorkspaceNotificationSettings(workspaceId);
  return {
    id: settings.id,
    workspaceId: settings.workspaceId,
    emailRecipients: settings.emailRecipients,
    webhookUrl: settings.webhookUrl,
    notifyMode: parseNotificationMode(settings.notifyMode),
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt,
  };
}

export function toNotificationSettingsDTO(settings: {
  id: string;
  workspaceId: string;
  emailRecipients: string | null;
  webhookUrl: string | null;
  notifyMode: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  const recipients = parseRecipients(settings.emailRecipients);
  return {
    id: settings.id,
    workspaceId: settings.workspaceId,
    emailRecipients: settings.emailRecipients,
    emailRecipientCount: recipients.length,
    webhookUrlMasked: maskWebhookUrl(settings.webhookUrl),
    webhookConfigured: Boolean(settings.webhookUrl),
    notifyMode: parseNotificationMode(settings.notifyMode),
    configured: recipients.length > 0 || Boolean(settings.webhookUrl),
    createdAt: settings.createdAt.toISOString(),
    updatedAt: settings.updatedAt.toISOString(),
  };
}

export function buildNotifyMessage(input: {
  action: { id: string; type: string; title: string; details: Prisma.JsonValue };
  sku: { id: string; sku: string; title: string } | null;
  workspace: { id: string; name: string };
}) {
  const suggestedPrice = (() => {
    if (!input.action.details || typeof input.action.details !== "object" || Array.isArray(input.action.details)) {
      return null;
    }
    const details = input.action.details as Record<string, unknown>;
    const final = details.suggestedPriceFinal;
    return typeof final === "number" ? final : null;
  })();

  const subject = `[PharOS] ${input.action.type} action applied${input.sku ? ` for ${input.sku.sku}` : ""}`;
  const lines = [
    `Workspace: ${input.workspace.name}`,
    `Action: ${input.action.title}`,
    `Type: ${input.action.type}`,
    ...(input.sku ? [`SKU: ${input.sku.title} (${input.sku.sku})`] : []),
    ...(suggestedPrice !== null ? [`Suggested price: ${suggestedPrice.toFixed(2)}`] : []),
    `Action ID: ${input.action.id}`,
  ];

  return {
    subject,
    text: lines.join("\n"),
    json: {
      workspace: {
        id: input.workspace.id,
        name: input.workspace.name,
      },
      action: {
        id: input.action.id,
        type: input.action.type,
        title: input.action.title,
      },
      sku: input.sku,
      suggestedPrice,
      timestamp: new Date().toISOString(),
    } as Prisma.InputJsonObject,
  };
}

export async function enqueueNotifications(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  actionId: string | null,
  message: { subject: string; text: string; json: Prisma.InputJsonObject },
) {
  const settings = await tx.workspaceNotificationSettings.findUnique({
    where: { workspaceId },
    select: {
      emailRecipients: true,
      webhookUrl: true,
    },
  });

  const outbox: Array<{ id: string; type: string }> = [];
  const recipients = parseRecipients(settings?.emailRecipients ?? null);
  if (recipients.length > 0) {
    const created = await tx.notificationOutbox.create({
      data: {
        workspaceId,
        actionId,
        type: "EMAIL",
        payload: {
          recipients,
          subject: message.subject,
          text: message.text,
          json: message.json,
        } as Prisma.InputJsonValue,
        status: "QUEUED",
      },
      select: { id: true, type: true },
    });
    outbox.push(created);
  }

  if (settings?.webhookUrl) {
    const created = await tx.notificationOutbox.create({
      data: {
        workspaceId,
        actionId,
        type: "WEBHOOK",
        payload: {
          url: settings.webhookUrl,
          body: message.json,
        } as Prisma.InputJsonValue,
        status: "QUEUED",
      },
      select: { id: true, type: true },
    });
    outbox.push(created);
  }

  return outbox;
}

function getSmtpPort() {
  const raw = process.env.SMTP_PORT;
  const value = Number(raw ?? 587);
  if (!Number.isFinite(value) || value <= 0) return 587;
  return value;
}

export async function sendEmail(message: { to: string[]; subject: string; text: string }) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? "PharOS <no-reply@pharos.local>";

  if (!host || !user || !pass) {
    throw new Error("SMTP is not configured");
  }

  const transporter = nodemailer.createTransport({
    host,
    port: getSmtpPort(),
    secure: false,
    auth: {
      user,
      pass,
    },
  });

  await transporter.sendMail({
    from,
    to: message.to.join(","),
    subject: message.subject,
    text: message.text,
  });
}

export async function sendWebhook(url: string, body: Record<string, unknown>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Webhook request failed (${response.status}): ${text.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

function parseEmailPayload(payload: Prisma.JsonValue) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const data = payload as Record<string, unknown>;
  const recipients = Array.isArray(data.recipients) ? data.recipients.filter((item): item is string => typeof item === "string") : [];
  const subject = typeof data.subject === "string" ? data.subject : null;
  const text = typeof data.text === "string" ? data.text : null;
  if (recipients.length === 0 || !subject || !text) return null;
  return { recipients, subject, text };
}

function parseWebhookPayload(payload: Prisma.JsonValue) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const data = payload as Record<string, unknown>;
  const url = typeof data.url === "string" ? data.url : null;
  const body = data.body && typeof data.body === "object" && !Array.isArray(data.body) ? (data.body as Record<string, unknown>) : null;
  if (!url || !body) return null;
  return { url, body };
}

export async function processNotificationOutbox(workspaceId: string, limit: number) {
  const settings = await getNotificationSettings(workspaceId);
  // Multi-instance safe claiming: SKIP LOCKED ensures only one worker claims each row.
  const claimed = await prisma.$queryRaw<Array<{ id: string; type: string; payload: Prisma.JsonValue }>>(
    Prisma.sql`
      WITH cte AS (
        SELECT id
        FROM "NotificationOutbox"
        WHERE "workspaceId" = ${workspaceId}
          AND status = 'QUEUED'
        ORDER BY "createdAt" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "NotificationOutbox" o
      SET status = 'RUNNING',
          attempts = o.attempts + 1,
          "updatedAt" = NOW()
      FROM cte
      WHERE o.id = cte.id
      RETURNING o.id, o.type, o.payload;
    `,
  );

  const processed: Array<{ outboxId: string; type: string; status: "SENT" | "FAILED"; dryRun: boolean; error?: string }> = [];

  for (const item of claimed) {
    const dryRun = settings.notifyMode === "DRY_RUN" || !notifyEnabled();

    if (dryRun) {
      await prisma.notificationOutbox.update({
        where: { id: item.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          lastError: null,
        },
      });
      await logTelemetry(prisma, workspaceId, "NOTIFICATION_SENT", {
        outboxId: item.id,
        type: item.type,
        dryRun: true,
      });
      processed.push({ outboxId: item.id, type: item.type, status: "SENT", dryRun: true });
      continue;
    }

    try {
      if (item.type === "EMAIL") {
        const payload = parseEmailPayload(item.payload);
        if (!payload) throw new Error("Invalid EMAIL payload");
        await sendEmail({
          to: payload.recipients,
          subject: payload.subject,
          text: payload.text,
        });
      } else if (item.type === "WEBHOOK") {
        const payload = parseWebhookPayload(item.payload);
        if (!payload) throw new Error("Invalid WEBHOOK payload");
        await sendWebhook(payload.url, payload.body);
      } else {
        throw new Error(`Unsupported notification type: ${item.type}`);
      }

      await prisma.notificationOutbox.update({
        where: { id: item.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          lastError: null,
        },
      });
      await logTelemetry(prisma, workspaceId, "NOTIFICATION_SENT", {
        outboxId: item.id,
        type: item.type,
        dryRun: false,
      });
      processed.push({ outboxId: item.id, type: item.type, status: "SENT", dryRun: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Notification dispatch failed";
      await prisma.notificationOutbox.update({
        where: { id: item.id },
        data: {
          status: "FAILED",
          lastError: message,
        },
      });
      await logTelemetry(prisma, workspaceId, "NOTIFICATION_FAILED", {
        outboxId: item.id,
        type: item.type,
      });
      processed.push({ outboxId: item.id, type: item.type, status: "FAILED", dryRun: false, error: message });
    }
  }

  return processed;
}
