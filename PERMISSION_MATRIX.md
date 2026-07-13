# FLYERO Berechtigungsmatrix

Stand: 13.07.2026

Die API prüft Berechtigungen serverseitig. Die Navigation darf Funktionen ausblenden, ist aber keine Sicherheitsgrenze.

| Berechtigung | Admin | Support/Disposition | Lager | Verteiler | Kunde |
| --- | --- | --- | --- | --- | --- |
| `accounting.export` | Ja | Nein | Nein | Nein | Nein |
| `accounting.export.download` | Ja | Nein | Nein | Nein | Nein |
| `accounting.export.archive` | Ja | Nein | Nein | Nein | Nein |
| `analytics.view` | Ja | Ja | Nein | Nein | Nein |
| `analytics.export` | Ja | Nein | Nein | Nein | Nein |
| `order.view` | Ja | Nein | Nein | Nein | Nein |
| `order.manage` | Ja | Nein | Nein | Nein | Nein |
| `dispatch.assign` | Ja | Ja | Nein | Nein | Nein |
| `dispatch.view` | Ja | Ja | Nein | Nein | Nein |
| `dispatch.manage` | Ja | Ja | Nein | Nein | Nein |
| `dispatch.auto-assign` | Ja | Nein | Nein | Nein | Nein |
| `tour.view` | Ja | Nein | Nein | Nein | Nein |
| `tour.manage` | Ja | Nein | Nein | Nein | Nein |
| `document.review` | Ja | Ja | Nein | Nein | Nein |
| `document.scan` | Ja | Nein | Nein | Nein | Nein |
| `invoice.view` | Ja | Ja | Nein | Nein | Nein |
| `invoice.admin.view` | Ja | Nein | Nein | Nein | Nein |
| `invoice.manage` | Ja | Nein | Nein | Nein | Nein |
| `internal-users.manage` | Ja | Nein | Nein | Nein | Nein |
| `payment.view` | Ja | Nein | Nein | Nein | Nein |
| `payment.refund` | Ja | Nein | Nein | Nein | Nein |
| `payment.reconcile` | Ja | Nein | Nein | Nein | Nein |
| `payment.dispute.manage` | Ja | Nein | Nein | Nein | Nein |
| `pricing.manage` | Ja | Nein | Nein | Nein | Nein |
| `report.review` | Ja | Ja | Nein | Nein | Nein |
| `report.publish` | Ja | Nein | Nein | Nein | Nein |
| `support.ticket.view` | Ja | Ja | Nein | Nein | Nein |
| `support.ticket.manage` | Ja | Ja | Nein | Nein | Nein |
| `warehouse.view` | Ja | Ja | Nein | Nein | Nein |
| `warehouse.manage` | Ja | Nein | Nein | Nein | Nein |
| `print-partner.view` | Ja | Ja | Nein | Nein | Nein |
| `print-partner.manage` | Ja | Nein | Nein | Nein | Nein |
| `print-order.view` | Ja | Ja | Nein | Nein | Nein |
| `print-order.manage` | Ja | Ja | Nein | Nein | Nein |

## Designregeln

- Globale Auftrags-, Rechnungs- und Zahlungslisten bleiben Admin-only. Support erhält keinen globalen Zugriff auf diese Ressourcen.
- Die operative Verteilerzuweisung nutzt `dispatch.assign` und bleibt für Support auf den aktiven Tenant-Scope begrenzt.

- Logistik-Lesezugriffe nutzen `warehouse.view`; Sendungen, Umlagerungen und Bestandsmutationen nutzen `warehouse.manage` und bleiben Admin-only.
- Eine Permission wird nur in der serverseitigen API als wirksam betrachtet.
- Kritische Finanz-, Preis-, Nutzer- und Veröffentlichungsaktionen sind auf `ADMIN` begrenzt.
- Support/Disposition darf operative Prüfungen durchführen, aber keine Zahlungen erstatten, Preise ändern, Nutzer sperren, Exporte laden oder Berichte veröffentlichen.
- Die Matrix ist bewusst noch plattformweit. Die spätere Tenant-Architektur muss jede Permission zusätzlich auf eine Unternehmensmitgliedschaft und einen Tenant-Scope beziehen.
