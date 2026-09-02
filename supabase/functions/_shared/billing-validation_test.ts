import {
  findOrganizationSubscription,
  getOrganizationId,
  getTransactionPriceIds,
  isPaddleSubscriptionId,
  isPaddleTransactionId,
  subscriptionBelongsToOrganization,
  transactionUsesAllowedPrice,
} from "./billing-validation.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

Deno.test("Paddle id validators reject wrong resource types", () => {
  assert(isPaddleTransactionId("txn_01k45k9mk2cv19pq4hhr2am3dn"), "valid txn id expected");
  assert(!isPaddleTransactionId("sub_01k45k9mk2cv19pq4hhr2am3dn"), "sub id must not pass txn validator");
  assert(isPaddleSubscriptionId("sub_01k45k9mk2cv19pq4hhr2am3dn"), "valid sub id expected");
  assert(!isPaddleSubscriptionId("txn_01k45k9mk2cv19pq4hhr2am3dn"), "txn id must not pass sub validator");
});

Deno.test("transaction organization metadata is required", () => {
  assert(getOrganizationId({ organization_id: "org-1" }) === "org-1", "org id expected");
  assert(getOrganizationId({}) === null, "missing org metadata must be null");
});

Deno.test("transaction must contain a configured Quizestro price", () => {
  const tx = {
    items: [
      { price: { id: "pri_01k45k9mk2cv19pq4hhr2am3dn" } },
      { price: { id: "pri_01k45k9mk2cv19pq4hhr2am3do" } },
    ],
  };

  assert(getTransactionPriceIds(tx).length === 2, "two price ids expected");
  assert(
    transactionUsesAllowedPrice(tx, new Set(["pri_01k45k9mk2cv19pq4hhr2am3do"])),
    "configured price should match"
  );
  assert(
    !transactionUsesAllowedPrice(tx, new Set(["pri_01k45k9mk2cv19pq4hhr2am3dp"])),
    "wrong product price must be rejected"
  );
});

Deno.test("subscription ownership is checked from custom_data", () => {
  const subscription = {
    id: "sub_01k45k9mk2cv19pq4hhr2am3dn",
    status: "active",
    custom_data: { organization_id: "org-1" },
  };
  assert(subscriptionBelongsToOrganization(subscription, "org-1"), "ownership expected");
  assert(!subscriptionBelongsToOrganization(subscription, "org-2"), "cross-org subscription must fail");
});

Deno.test("subscription recovery finds only matching active organization subscription", () => {
  const subscriptions = [
    {
      id: "sub_01k45k9mk2cv19pq4hhr2am3dn",
      status: "active",
      custom_data: { organization_id: "org-2" },
    },
    {
      id: "sub_01k45k9mk2cv19pq4hhr2am3do",
      status: "canceled",
      custom_data: { organization_id: "org-1" },
    },
    {
      id: "sub_01k45k9mk2cv19pq4hhr2am3dp",
      status: "past_due",
      custom_data: { organization_id: "org-1" },
    },
  ];

  const match = findOrganizationSubscription(subscriptions, "org-1");
  assert(match?.id === "sub_01k45k9mk2cv19pq4hhr2am3dp", "recoverable org subscription expected");
});
