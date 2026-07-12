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
| `document.review` | Ja | Ja | Nein | Nein | Nein |
| `internal-users.manage` | Ja | Nein | Nein | Nein | Nein |
| `payment.refund` | Ja | Nein | Nein | Nein | Nein |
| `payment.reconcile` | Ja | Nein | Nein | Nein | Nein |
| `pricing.manage` | Ja | Nein | Nein | Nein | Nein |
| `report.review` | Ja | Ja | Nein | Nein | Nein |
| `report.publish` | Ja | Nein | Nein | Nein | Nein |

## Designregeln

- Eine Permission wird nur in der serverseitigen API als wirksam betrachtet.
- Kritische Finanz-, Preis-, Nutzer- und Veröffentlichungsaktionen sind auf `ADMIN` begrenzt.
- Support/Disposition darf operative Prüfungen durchführen, aber keine Zahlungen erstatten, Preise ändern, Nutzer sperren, Exporte laden oder Berichte veröffentlichen.
- Die Matrix ist bewusst noch plattformweit. Die spätere Tenant-Architektur muss jede Permission zusätzlich auf eine Unternehmensmitgliedschaft und einen Tenant-Scope beziehen.
