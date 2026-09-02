import {
  canInviteRole,
  isInviteRole,
} from "./authorization.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

Deno.test("owner can invite admin or user", () => {
  assert(canInviteRole("owner", "admin"), "owner should be able to invite admin");
  assert(canInviteRole("owner", "user"), "owner should be able to invite user");
});

Deno.test("admin can invite only user", () => {
  assert(canInviteRole("admin", "user"), "admin should be able to invite user");
  assert(!canInviteRole("admin", "admin"), "admin must not be able to invite admin");
});

Deno.test("regular user cannot invite members", () => {
  assert(!canInviteRole("user", "user"), "user must not be able to invite user");
  assert(!canInviteRole("user", "admin"), "user must not be able to invite admin");
});

Deno.test("invite role parser rejects owner and unknown values", () => {
  assert(isInviteRole("user"), "user must be valid invite role");
  assert(isInviteRole("admin"), "admin must be valid invite role");
  assert(!isInviteRole("owner"), "owner must never be a valid invite role");
  assert(!isInviteRole("superadmin"), "unknown role must be rejected");
  assert(!isInviteRole(null), "non-string role must be rejected");
});
