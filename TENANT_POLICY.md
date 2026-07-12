# FLYERO Tenant- und Rollen-Policy

## Grundsatz

`ADMIN` ist im aktuellen Modell die globale Plattform-Administration. Alle anderen Rollen benötigen für sensible Unternehmenspfade eine aktive `TenantMembership`, deren Tenant-ID mit der Session übereinstimmt.

| Plattformrolle | Erlaubte Tenant-Rollen |
| --- | --- |
| `SUPPORT_DISPATCHER` | `SUPPORT`, `DISPATCHER`, `OWNER`, `ADMIN` |
| `WAREHOUSE_STAFF` | `WAREHOUSE`, `OWNER`, `ADMIN` |
| `DISTRIBUTOR` | `DISTRIBUTOR`, `OWNER`, `ADMIN` |
| `CUSTOMER` | `OWNER`, `ADMIN` |

`requirePermission()` prüft neben der Permission die aktive Membership. Dokument- und Reportlisten sowie deren Detail-/Freigabepfade verwenden zusätzlich den Tenant-Filter. Ein fehlender Tenant oder eine inaktive Membership führt serverseitig zu `403`.

## Migration

`20260712222000_internal_tenant_memberships` legt den internen Tenant `flyero-internal` an und ordnet bisher tenantlose Support-/Lagerkonten diesem Tenant zu. Das Seed reproduziert dieselbe Zuordnung. Plattform-Admins bleiben bewusst global, bis ein separates Plattform-Admin-/Unternehmensadmin-Modell eingeführt ist.

## Bekannte Grenzen

- Noch nicht jeder historische Admin-/Supportpfad verwendet `tenantWhereForSession`.
- Globale Plattform-Admins sind weiterhin bewusst allmächtig.
- Mitarbeiterverwaltung, Einladungen und Tenant-Wechsel brauchen einen kontrollierten UI-Workflow.
- Eine vollständige A/B-IDOR-Matrix für alle Ressourcen bleibt offen.
