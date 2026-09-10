import { MANUAL_BANK_TRANSFER } from "@/lib/paymentInstructions";

type Props = {
  orderNumber: string;
  amount: string;
};

export function ManualBankTransfer({ orderNumber, amount }: Props) {
  return (
    <details className="customerSoftDetails customerBankTransfer">
      <summary>Alternativ per Banküberweisung zahlen</summary>
      <div>
        <p>Wenn du nicht per Stripe zahlen möchtest, kannst du den offenen Betrag manuell überweisen. Bitte gib die Auftragsnummer exakt als Verwendungszweck an.</p>
        <dl className="customerBankDetails">
          <div><dt>Betrag</dt><dd>{amount}</dd></div>
          <div><dt>Kontoinhaberin</dt><dd>{MANUAL_BANK_TRANSFER.accountHolder}</dd></div>
          <div><dt>IBAN</dt><dd>{MANUAL_BANK_TRANSFER.iban}</dd></div>
          <div><dt>Verwendungszweck</dt><dd>{orderNumber}</dd></div>
        </dl>
        <p className="customerBankHint">Der Zahlungseingang wird manuell geprüft. Die Umsetzung startet erst, sobald der Zahlungseingang bestätigt wurde.</p>
      </div>
    </details>
  );
}
