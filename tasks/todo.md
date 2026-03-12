# Socio — Task Backlog

## Format
- [ ] pending
- [x] done
- [~] in progress

---

## Priority 1 — Core Fixes (app is broken without these)

- [ ] Fix `User.staff` link in AuthContext so staff users can submit availability
  - AuthContext `User` type is missing `staff: { id, name, staffType, gender }` field
  - `StaffAvailability.tsx:140` — `user?.staff?.id` is always undefined for staff role
- [ ] Add Absences frontend page (backend fully ready)
- [ ] Add Vacations frontend page (backend fully ready)

## Priority 2 — Scheduler Completeness

- [ ] Make scheduler respect approved absences (skip staff with active approved absences)
- [ ] Make shift times configurable per Rule (not hardcoded 08:00–20:00 / 20:00–08:00)
- [ ] Allow advance schedule generation (pick any week, not just current)
- [ ] Add qualification filtering to scheduler (Rule.requiredQualifications field missing from schema)

## Priority 3 — UX & Polish

- [ ] Add Shift Swaps frontend page (backend fully ready)
- [ ] Add Working Time Accounts frontend page (backend fully ready)
- [ ] Fix `StaffAvailability` dead branch for managers (StaffAvailabilityOverview renders immediately, rest unreachable)
- [ ] Make availability recurring (weekly pattern, not one-off date ranges)

## Priority 4 — Hardening

- [ ] Remove legacy Post/Comment/Like/Follow routes and schema models
- [ ] Add refresh token flow (current 8h JWT has no refresh mechanism)
- [ ] Add rate limiting to auth endpoints

---

## Completed

- [x] Singleton PrismaClient (was 11 separate instances)
- [x] JWT expiry (8h) + remove fallback secret
- [x] Add `role` + `staffId` to auth middleware
- [x] Add `requireRole` middleware helper
- [x] Secure all staff/rules/reports/scheduling/schedule-edits routes
- [x] Fix GET scheduling routes (were calling generateSchedule — now read-only)
- [x] Fix date mutation bug in schedulingService
- [x] Add idempotency to schedule generation (deleteMany before insert)
- [x] Remove phantom `rule.requiredQualifications` reference
- [x] Use `createMany` for bulk shift insert
- [x] Fix hardcoded localhost:5001 URL in Dashboard
- [x] Unify toast library (removed react-hot-toast, shadcn useToast only)
- [x] Fix spreadsheet export (was regenerating schedule on export)
