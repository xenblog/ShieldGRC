# DagrofaShield - Architecture

## Org-unit scoping model

Every core entity (Risk, RiskAssessment, Control, Framework, and User via a
join table) carries an `orgUnitId` (or, for User, a many-to-many
`UserOrgUnit` membership table), representing a Dagrofa legal entity /
business unit. Three are seeded: Dagrofa ApS, Dagrofa Logistik, Dagrofa
Foodservice.

`TreatmentAction` and `ControlTest` deliberately do **not** carry their own
`orgUnitId` - they inherit scope from their parent (`Risk.orgUnitId` /
`Control.orgUnitId`). This was a conscious choice to avoid a second,
independently-editable copy of "which org unit does this belong to" that
could drift from the parent it's actually filed under.

Access control is centralized in one place -
[`OrgUnitScopeService`](./backend/src/common/org-unit-scope/org-unit-scope.service.ts)
- rather than repeated ad hoc checks in every service:

| Role | Read | Write |
|---|---|---|
| **Admin** | All org units | All org units |
| **Executive/Board Viewer** | All org units, aggregated/group-level (read-only) | None |
| **Risk Owner** | Only assigned org unit(s) | Only assigned org unit(s) |
| **Auditor** | Only assigned org unit(s) (read-only) | None |

Role is a single global attribute on `User`; org-unit membership
(`UserOrgUnit`) is a separate relation that only matters for Risk
Owner/Auditor scoping - Admin and Executive ignore it entirely (Executive
specifically because their view is defined as group-level regardless of
which org units they happen to be a member of).

Any user - regardless of role - can additionally be the `owner`/`leadAssessor`/
`tester` on a specific Risk/Assessment/Control-test; that's a plain relation
field, not a role, and carries no extra scoping semantics of its own (the
row's own `orgUnitId` still governs who can see/edit it).

**A note on a bug we caught and fixed while building this**: the natural way
to combine "the user's org-unit scope" with "an optional `?orgUnitId=`
filter from a list endpoint's query string" is
`{ ...scope.readWhere(user), orgUnitId: query.orgUnitId }`. That's wrong in
two ways - when `query.orgUnitId` is undefined, the later key silently
overwrites (deletes) the scope's `{ in: [...] }` restriction, leaking every
org unit to a Risk Owner/Auditor; and when it *is* defined, it can replace
the restriction with an org unit outside the user's scope entirely. Every
service in this codebase instead calls
`OrgUnitScopeService.orgUnitWhere(user, explicitOrgUnitId)`, which combines
the two via a Prisma `AND` clause so neither can clobber the other. See the
tests in `org-unit-scope.service.spec.ts` (`orgUnitWhere` describe block)
and `test/auth-rbac.e2e-spec.ts` for regression coverage of exactly this.

RBAC is enforced at the API layer via two global guards
(`JwtAuthGuard` → `RolesGuard`, see `app.module.ts`) plus per-service
org-unit checks (`assertCanWriteOrgUnit`/`assertCanReadOrgUnit`) - the
frontend's own role gating (hiding buttons, filtering nav items) is a UX
convenience only and is never trusted as the actual boundary.

## RBAC model (roles vs. assignment)

Roles (`UserRole` enum: `ADMIN`, `RISK_OWNER`, `AUDITOR`, `EXECUTIVE`) gate
*what kind of action* a user can attempt at all (`@Roles(...)` decorator +
`RolesGuard`, see `common/guards/`). Org-unit scoping (above) then gates
*which rows* a permitted action can touch. The two are deliberately
orthogonal: a Risk Owner isn't "half a role" per org unit - they hold one
global role, and are simply a member of one or more org units.

## Audit log design

Every create/update/delete on a Risk, RiskAssessment, TreatmentAction,
Control, ControlTest, or Framework writes an `AuditLog` row (`entityType`,
`entityId`, `action`, `actorId`, `beforeData`/`afterData` JSON snapshots,
`createdAt`) inside the same DB transaction as the change itself
(`AuditService.record`, called with the transaction handle - see any
service's `create`/`update`/`remove`). This makes the audit write atomic
with the change it describes: if one fails, so does the other.

The log is immutable by construction - no service or controller in this
codebase ever exposes an update or delete for `AuditLog` rows, and the only
read path is `AuditLogController` (Admin-only). **Production hardening
note**: for defense in depth beyond "the application code never does this",
consider also revoking `UPDATE`/`DELETE` grants on the `audit_logs` table
from the application's own DB role via a manual `REVOKE` (Prisma's
migration DSL doesn't model DB-level grants, so this would be a hand-written
SQL step in your deployment).

## Category taxonomy

`Category` is a plain, admin-editable table (`name`, `isActive`,
`sortOrder`) - not a hardcoded enum - seeded with: IT-sikkerhed,
Informationssikkerhed, AI-governance, Leverandørkæde, Fysisk sikkerhed. Risk
uses it as `categoryId`; Control uses the exact same table as
`domainCategoryId` (surfaced in the UI as "Domain") so risks and controls
can eventually be cross-referenced by the same taxonomy value. Growing the
list (e.g. adding a category for a future module) is an admin UI action, not
a migration.

Separately, `NistCsfFunction` (Govern/Identify/Protect/Detect/Respond/
Recover) is a fixed enum, not a configurable table, because the spec treats
it as a stable, externally-defined tag rather than something Dagrofa will
be growing on its own - it's an optional secondary tag on Risk and Control,
never the primary grouping key.

## Extensibility: AI Governance and Supplier Risk

Both future modules need to link a not-yet-built entity (`AiSystem`,
`Supplier`) to existing Risks and Controls, many-to-many, **without altering
the `Risk` or `Control` tables**. `EntityLink`
(`backend/prisma/schema.prisma`) is the seam that makes that possible today:

```prisma
model EntityLink {
  riskId      String?          // real FK -> Risk, nullable
  controlId   String?          // real FK -> Control, nullable
  targetType  LinkedEntityType // enum: AI_SYSTEM | SUPPLIER (extend as needed)
  targetId    String           // id of the future AiSystem/Supplier row - no FK yet
  targetLabel String?          // cached display name so links render before the target table exists
}
```

Exactly one of `riskId`/`controlId` should be set per row (enforced at the
service layer today; a DB `CHECK` constraint would be a good addition via a
hand-written migration once a consuming service exists). `targetId` is a
plain string, not yet backed by a foreign key, because the `AiSystem` and
`Supplier` tables don't exist. When the AI Governance or Supplier Risk
module is actually built:

1. Add the new table (`AiSystem` or `Supplier`) in its own migration.
2. Add a new `LinkedEntityType` enum value if one doesn't already fit.
3. Point the new module's service at `EntityLink` rows filtered by
   `targetType`, resolving `targetId` against the new table.

No migration ever needs to touch `Risk` or `Control` themselves.

The nav already reserves the exact information architecture slots for both
modules (`components/layout/nav-config.ts`), rendered locked/"coming later"
so the full IA is legible today even though the modules aren't built.

## Auth provider abstraction

`AuthService` never talks to Entra ID or a password hash directly - it only
issues/refreshes/revokes DagrofaShield's own JWT+refresh-token session,
given a resolved `User`. Resolving *how* a login attempt maps to a `User` is
delegated to one of two interfaces
(`backend/src/modules/auth/providers/auth-provider.interface.ts`):

- `CredentialsAuthProvider` (`LocalAuthProvider`): email+password against
  `User.passwordHash` (bcrypt). Used by the seeded local admin and any other
  locally-provisioned account.
- `RedirectAuthProvider` (`EntraAuthProvider`): OIDC authorization-code flow
  against Entra ID via `openid-client`, provisioning a `User` on first
  sign-in with a conservative default role (least privilege - an Admin must
  assign org units and elevate the role afterward).

A future external-supplier invite/magic-link flow is a third implementation
of one of these same interfaces, plumbed into `AuthController` the same way
- `AuthService`'s token issuance/refresh/logout code does not change.

## Scoring: live, and re-triggerable from more than one place

`recalculateRiskScores` (`common/scoring/scoring.util.ts`) is a pure
function - no DB/HTTP dependency - so it's unit-testable in isolation and
callable from anywhere a risk's likelihood/impact/residual values change:
`RisksService.create`/`update` today; a future control-test result handler
or a completed-treatment-action handler tomorrow, without needing to know
about each other.

## What's out of scope for now (by design, not oversight)

- **AI Governance** (EU AI Act) and **Supplier Risk** (NIS2 supplier
  tracking) modules - see Extensibility above.
- A DB-level `CHECK` constraint enforcing "exactly one of `riskId`/
  `controlId`" on `EntityLink` (currently app-layer only, since no consumer
  exists yet to validate against).
- SAML as an auth provider (the abstraction supports it - only the OIDC
  implementation exists today, since Entra ID's OIDC endpoint was assumed
  sufficient for "Entra ID as the primary login method").
