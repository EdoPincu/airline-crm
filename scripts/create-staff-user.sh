#!/usr/bin/env bash
# Create a confirmed staff user for the CRM.
#
#   ./scripts/create-staff-user.sh <email> [password]
#
# Staff accounts cannot be self-registered (signup is disabled on the project),
# so this is the supported way to add someone. The service_role key is read from
# the Supabase CLI at runtime and never written to disk.
set -euo pipefail

REF="qqjbomzxqvbauutvhrpk"
EMAIL="${1:-}"
PASSWORD="${2:-$(openssl rand -base64 18 | tr -d '/+=' | head -c 16)}"

if [ -z "$EMAIL" ]; then
  echo "usage: $0 <email> [password]" >&2
  exit 1
fi

echo "Fetching service key from Supabase CLI..."
KEY="$(supabase projects api-keys --project-ref "$REF" --output-format json \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
      const k=JSON.parse(s).keys.find(x=>x.id==='service_role'||x.name==='service_role');
      if(!k){console.error('service_role key not found');process.exit(1);}
      process.stdout.write(k.api_key);})")"

echo "Creating $EMAIL ..."
RESP="$(curl -sS -X POST "https://$REF.supabase.co/auth/v1/admin/users" \
  -H "apikey: $KEY" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"email_confirm\":true}")"

if echo "$RESP" | grep -q '"id"'; then
  echo
  echo "  Staff user created and confirmed."
  echo "  email:    $EMAIL"
  echo "  password: $PASSWORD"
  echo
  echo "  Sign in at http://localhost:5173 — save the password now."
else
  echo "Failed:" >&2
  echo "$RESP" >&2
  exit 1
fi
