const TRANSACTION_ID = /^txn_[a-z\d]{26}$/;
const SUBSCRIPTION_ID = /^sub_[a-z\d]{26}$/;
const PRICE_ID = /^pri_[a-z\d]{26}$/;

export function isPaddleTransactionId(value: unknown): value is string {
  return typeof value === "string" && TRANSACTION_ID.test(value);
}

export function isPaddleSubscriptionId(value: unknown): value is string {
  return typeof value === "string" && SUBSCRIPTION_ID.test(value);
}

export function isPaddlePriceId(value: unknown): value is string {
  return typeof value === "string" && PRICE_ID.test(value);
}

export function getOrganizationId(customData: any): string | null {
  const value = customData?.organization_id ?? customData?.organizationId;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function getTransactionPriceIds(transaction: any): string[] {
  const items = Array.isArray(transaction?.items) ? transaction.items : [];
  return items
    .map((item: any) => item?.price?.id ?? item?.price_id)
    .filter((value: unknown): value is string => isPaddlePriceId(value));
}

export function transactionUsesAllowedPrice(
  transaction: any,
  allowedPriceIds: ReadonlySet<string>
): boolean {
  if (allowedPriceIds.size === 0) return false;
  return getTransactionPriceIds(transaction).some((id) => allowedPriceIds.has(id));
}

export function subscriptionBelongsToOrganization(
  subscription: any,
  organizationId: string
): boolean {
  return (
    isPaddleSubscriptionId(subscription?.id) &&
    getOrganizationId(subscription?.custom_data) === organizationId
  );
}

const RECOVERABLE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "paused",
]);

export function findOrganizationSubscription(
  subscriptions: any[],
  organizationId: string
): any | null {
  return (
    subscriptions.find((subscription) => {
      const status = String(subscription?.status ?? "").toLowerCase();
      return (
        RECOVERABLE_SUBSCRIPTION_STATUSES.has(status) &&
        subscriptionBelongsToOrganization(subscription, organizationId)
      );
    }) ?? null
  );
}
