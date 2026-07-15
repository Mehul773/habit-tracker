# API smoke (run vs `npm run build` then `npx wrangler dev`)

1. Reset local DB: `npm run db:local`
2. State is public:
   `curl -s localhost:8787/api/state | jq '.habits | length'` → 8
3. Write rejected before a password exists AND gate fails (no hash):
   `curl -s -X PUT localhost:8787/api/entries -H 'authorization: Bearer x' -d '{"habit_id":1,"date":"2026-07-15","done":1}'`
   → `{"error":"unauthorized"}` (no password set yet → verify false)
4. First-run set password (no current needed):
   `curl -s -X POST localhost:8787/api/auth/set -d '{"newPassword":"9876543210"}'` → `{"ok":true}`
5. Verify:
   `curl -s -X POST localhost:8787/api/auth/verify -d '{"password":"9876543210"}'` → `{"ok":true}`
   `curl -s -X POST localhost:8787/api/auth/verify -d '{"password":"nope"}'` → `{"ok":false}`
6. Gated write now works with bearer:
   `curl -s -X PUT localhost:8787/api/entries -H 'authorization: Bearer 9876543210' -d '{"habit_id":1,"date":"2026-07-15","done":1}'` → `{"ok":true}`
7. Upsert idempotent (same call again) → `{"ok":true}`, and:
   `curl -s "localhost:8787/api/state" | jq '.entries | map(select(.habit_id==1 and .date=="2026-07-15")) | length'` → 1
8. Change password requires correct current:
   `curl -s -X POST localhost:8787/api/auth/set -d '{"newPassword":"1111","currentPassword":"wrong"}'` → 401
   `curl -s -X POST localhost:8787/api/auth/set -d '{"newPassword":"1111","currentPassword":"9876543210"}'` → `{"ok":true}`
9. state never leaks the hash:
   `curl -s localhost:8787/api/state | grep -i edit_password_hash` → (no output)
