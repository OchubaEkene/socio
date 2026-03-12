# Lessons Learned

Patterns and rules to prevent repeating mistakes.

---

## Architecture

### Always use a singleton DB client
**Mistake**: Every route file instantiated `new PrismaClient()` — 11 separate connection pools.
**Rule**: Always import from `lib/prisma.ts`. Never write `new PrismaClient()` in a route or service file.

### GET endpoints must never have side effects
**Mistake**: `GET /scheduling/week/:weekStart` and `GET /scheduling/current-week` both called `generateSchedule()`, which writes to the DB. Every dashboard load regenerated the schedule.
**Rule**: GET = read only. Any endpoint that writes data must be POST/PUT/PATCH/DELETE. If a "read" endpoint is populating data on first access, that logic belongs in a separate POST endpoint.

### Exports must read, not generate
**Mistake**: The Excel/CSV export routes called `generateSchedule()` — exporting triggered a full schedule regeneration.
**Rule**: Export endpoints must consume already-generated data via a read function (`getWeekSchedule`), never regenerate.

---

## Date Handling

### Never mutate a Date object passed as a function argument
**Mistake**: `date.setHours(8, 0, 0, 0)` mutates the passed-in Date in place. When called twice for day/night shifts, the second call operated on an already-modified object.
**Rule**: Always create a new Date before calling `.setHours()`:
```ts
// Wrong
new Date(date.setHours(8, 0, 0, 0))

// Right
new Date(new Date(date.getTime()).setHours(8, 0, 0, 0))
// or
new Date(new Date(dateMs).setHours(8, 0, 0, 0))
```

---

## Security

### Never use a fallback JWT secret
**Mistake**: `jwt.sign(..., process.env.JWT_SECRET || 'fallback-secret')` — if env var is missing in production, all tokens are signed with a known string.
**Rule**: Always throw if `JWT_SECRET` is not set. Never provide a fallback for security-critical env vars.

### JWTs must have an expiry
**Mistake**: `jwt.sign({ userId })` with no `expiresIn` — tokens were valid forever.
**Rule**: Always set `expiresIn`. Default to `'8h'` for session tokens.

### Auth middleware must attach role
**Mistake**: `authenticateToken` only attached `{ id, email, username }` — no `role`. Role-based guards had no data to check.
**Rule**: Auth middleware must always select and attach `role` and `staffId` to `req.user`. Add `requireRole(...roles)` helper for route-level guards.

### All mutation endpoints need authentication
**Mistake**: Staff CRUD, rules, scheduling, and reports were all unauthenticated — anyone could call them.
**Rule**: Before shipping any route file, verify every route has `authenticateToken` and appropriate `requireRole` applied. Read endpoints = auth. Write/delete endpoints = auth + role guard.

---

## Schema vs Service Consistency

### Check schema before referencing model fields in service code
**Mistake**: `schedulingService.ts` referenced `rule.requiredQualifications` — a field that doesn't exist in the `Rule` model. The filter silently did nothing.
**Rule**: Before writing service logic that reads a model field, verify the field exists in `schema.prisma`. If it doesn't exist, either add it via migration or remove the reference.

---

## Frontend

### Pick one toast library and stick to it
**Mistake**: `Dashboard.tsx` imported both `react-hot-toast` and shadcn's `useToast`, using both in the same component.
**Rule**: This project uses shadcn `useToast` exclusively. Never import `react-hot-toast`.

### Never hardcode localhost URLs in frontend code
**Mistake**: `fetch('http://localhost:5001/api/...')` in Dashboard — breaks in any non-local environment.
**Rule**: Always use the shared `api` axios instance from `@/lib/api`. It reads `VITE_API_URL` from env and handles auth headers automatically.

### Type the full API response shape in AuthContext
**Mistake**: `AuthContext` `User` type was missing the `staff` field even though the backend returns it. Led to `user?.staff?.id` being undefined at runtime for staff-role users.
**Rule**: When the backend returns a nested object, make sure the frontend type reflects it completely. Check auth response shape against the AuthContext `User` interface whenever changing the login/register response.
