

## Problem Analysis

Organization "Tesla Kviz" has `subscription_id: "sub_01kk09r3d6024rw250a9x592bc"`, `subscription_tier: "premium"`, `subscription_status: "active"`. The `billing-cancel` function reaches the `PADDLE_API_KEY` check and gets null.

**Root cause**: `billing-cancel` is missing from `supabase/config.toml`. All other billing functions (`billing-checkout`, `billing-webhook`, `billing-confirm`) are listed there. Without the config entry, the function may not have proper access to secrets.

## Plan

### 1. Add `billing-cancel` to `supabase/config.toml`

Add the missing function config entry with `verify_jwt = false` (same as other billing functions).

### 2. Change cancellation to use Paddle management URL (redirect approach)

Instead of directly calling Paddle's cancel API, modify `billing-cancel` to:
- Fetch the subscription via `GET /subscriptions/{subscription_id}` from Paddle API
- Extract `management_urls.cancel` from the response
- Return the cancel URL to the frontend

Modify `PricingPage.tsx` to:
- Open the Paddle cancel URL in a new tab/window when the user confirms downgrade
- Show a toast telling the user to complete cancellation on Paddle's page

This is more reliable and gives users the standard Paddle cancellation experience with confirmation.

### 3. Add debug logging

Add `console.log` for the API key availability check so future issues are easier to diagnose.

