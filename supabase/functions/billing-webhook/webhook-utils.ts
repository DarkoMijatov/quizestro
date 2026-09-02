export type WebhookProcessingStatus = "processing" | "processed" | "failed";

export function extractOrganizationId(data: any): string | null {
  return (
    data?.custom_data?.organization_id ||
    data?.custom_data?.organizationId ||
    data?.subscription?.custom_data?.organization_id ||
    data?.items?.[0]?.price?.custom_data?.organization_id ||
    data?.transaction?.custom_data?.organization_id ||
    null
  );
}

export function extractSubscriptionId(eventType: string, data: any): string | null {
  if (eventType.startsWith("subscription.")) {
    const id = data?.id;
    return typeof id === "string" && id.startsWith("sub_") ? id : null;
  }

  if (eventType.startsWith("transaction.")) {
    const id = data?.subscription_id || data?.subscription?.id;
    return typeof id === "string" && id.startsWith("sub_") ? id : null;
  }

  return null;
}

export function isOlderEvent(
  incomingOccurredAt: string | null | undefined,
  lastOccurredAt: string | null | undefined
): boolean {
  if (!incomingOccurredAt || !lastOccurredAt) return false;
  const incoming = Date.parse(incomingOccurredAt);
  const last = Date.parse(lastOccurredAt);
  if (Number.isNaN(incoming) || Number.isNaN(last)) return false;
  return incoming < last;
}

export function isWebhookTimestampFresh(
  timestampSeconds: string,
  nowMs: number,
  toleranceSeconds: number
): boolean {
  const ts = Number(timestampSeconds);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(Math.floor(nowMs / 1000) - ts) <= toleranceSeconds;
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
