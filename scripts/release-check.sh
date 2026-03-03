#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/release-check.sh [options]

Checks production readiness for Quizestro frontend + Supabase edge functions.

Options:
  --domain DOMAIN              Custom domain to verify (default: quizestro.darkmsolutions.com)
  --supabase-url URL           Supabase project URL (or use VITE_SUPABASE_URL env)
  --skip-network               Skip DNS/HTTP checks and only validate local env/config
  --help                       Show this help message
USAGE
}

DOMAIN="quizestro.darkmsolutions.com"
SUPABASE_URL="${VITE_SUPABASE_URL:-}"
SKIP_NETWORK="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)
      DOMAIN="${2:-}"
      shift 2
      ;;
    --supabase-url)
      SUPABASE_URL="${2:-}"
      shift 2
      ;;
    --skip-network)
      SKIP_NETWORK="true"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ -z "$SUPABASE_URL" ]]; then
  SUPABASE_URL="${SUPABASE_URL:-}"
fi

ok() { echo "✅ $*"; }
warn() { echo "⚠️  $*"; }
err() { echo "❌ $*"; }

failed=0

require_env() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "$value" ]]; then
    err "Missing required env var: $name"
    failed=1
  else
    ok "$name is set"
  fi
}

echo "== Quizestro release check =="
echo "Domain: $DOMAIN"

# Frontend env variables
require_env VITE_SUPABASE_URL
require_env VITE_SUPABASE_ANON_KEY

# Optional server-side secrets (only warns in local check)
for optional_secret in \
  SUPABASE_SERVICE_ROLE_KEY \
  LEMONSQUEEZY_API_KEY \
  LEMONSQUEEZY_STORE_ID \
  LEMONSQUEEZY_VARIANT_ID_MONTHLY \
  LEMONSQUEEZY_VARIANT_ID_ANNUAL \
  LEMONSQUEEZY_WEBHOOK_SECRET \
  POSTMARK_SERVER_TOKEN \
  POSTMARK_FROM_EMAIL; do
  if [[ -z "${!optional_secret:-}" ]]; then
    warn "$optional_secret is not set in local shell (ensure it exists in Supabase secrets)"
  else
    ok "$optional_secret is set"
  fi
done

# Directory checks
if [[ -d dist ]]; then
  ok "dist/ exists (frontend build artifact present)"
else
  warn "dist/ does not exist yet (run npm run build before upload to Mint)"
fi

for fn in billing-checkout billing-webhook billing-cancel send-email; do
  if [[ -f "supabase/functions/$fn/index.ts" ]]; then
    ok "Edge function present: $fn"
  else
    err "Missing edge function file: supabase/functions/$fn/index.ts"
    failed=1
  fi
done

if [[ "$SKIP_NETWORK" == "false" ]]; then
  if command -v dig >/dev/null 2>&1; then
    dns_result="$(dig +short "$DOMAIN" | head -n 1 || true)"
    if [[ -n "$dns_result" ]]; then
      ok "DNS resolves: $DOMAIN -> $dns_result"
    else
      err "DNS does not resolve for $DOMAIN"
      failed=1
    fi
  else
    warn "dig is not installed; skipping DNS check"
  fi

  if command -v curl >/dev/null 2>&1; then
    if curl -fsSI "https://$DOMAIN" >/dev/null; then
      ok "HTTPS reachable: https://$DOMAIN"
    else
      err "Cannot reach https://$DOMAIN"
      failed=1
    fi

    if [[ -n "$SUPABASE_URL" ]]; then
      webhook_url="${SUPABASE_URL%/}/functions/v1/billing-webhook"
      if curl -fsSI "$webhook_url" >/dev/null; then
        ok "Supabase function endpoint reachable: $webhook_url"
      else
        warn "Could not verify endpoint: $webhook_url (may still be fine if auth/proxy blocks HEAD)"
      fi
    else
      warn "SUPABASE_URL not provided for endpoint reachability check"
    fi
  else
    warn "curl is not installed; skipping HTTP checks"
  fi
else
  warn "Network checks skipped (--skip-network)"
fi

if [[ $failed -eq 1 ]]; then
  echo "\nRelease check finished with blocking issues."
  exit 1
fi

echo "\nRelease check passed (or only non-blocking warnings)."
