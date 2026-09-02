import {
  extractSubscriptionId,
  isOlderEvent,
  isWebhookTimestampFresh,
  timingSafeEqualHex,
} from "./webhook-utils.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

Deno.test("transaction.completed uses subscription_id, never transaction id", () => {
  const data = { id: "txn_123", subscription_id: "sub_456" };
  assert(
    extractSubscriptionId("transaction.completed", data) === "sub_456",
    "transaction event must resolve sub_ id"
  );
});

Deno.test("subscription events use data.id only when it is a subscription id", () => {
  assert(
    extractSubscriptionId("subscription.updated", { id: "sub_123" }) === "sub_123",
    "subscription event should use sub_ id"
  );
  assert(
    extractSubscriptionId("subscription.updated", { id: "txn_123" }) === null,
    "non-subscription id must be rejected"
  );
});

Deno.test("older webhook events are detected", () => {
  assert(
    isOlderEvent("2026-09-02T10:00:00Z", "2026-09-02T11:00:00Z"),
    "older event should be stale"
  );
  assert(
    !isOlderEvent("2026-09-02T12:00:00Z", "2026-09-02T11:00:00Z"),
    "newer event should not be stale"
  );
});

Deno.test("signature timestamps outside tolerance are rejected", () => {
  const nowMs = Date.parse("2026-09-02T12:00:00Z");
  const nowSeconds = String(Math.floor(nowMs / 1000));
  const staleSeconds = String(Math.floor(nowMs / 1000) - 301);
  assert(isWebhookTimestampFresh(nowSeconds, nowMs, 300), "fresh timestamp should pass");
  assert(!isWebhookTimestampFresh(staleSeconds, nowMs, 300), "stale timestamp should fail");
});

Deno.test("hex comparison is length-aware and timing-safe style", () => {
  assert(timingSafeEqualHex("abcd", "abcd"), "equal hashes should match");
  assert(!timingSafeEqualHex("abcd", "abce"), "different hashes should not match");
  assert(!timingSafeEqualHex("abcd", "abc"), "different lengths should not match");
});
