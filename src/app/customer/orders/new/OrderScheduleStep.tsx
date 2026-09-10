"use client";

type OrderScheduleStepProps = {
  minimumStartDate: string;
  startDate: string;
  endDate: string;
  flexibleScheduling: boolean;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onFlexibleSchedulingChange: (value: boolean) => void;
};

export function OrderScheduleStep({
  minimumStartDate,
  startDate,
  endDate,
  flexibleScheduling,
  onStartDateChange,
  onEndDateChange,
  onFlexibleSchedulingChange,
}: OrderScheduleStepProps) {
  return (
    <section className="orderPanelBlock inlineStepBlock">
      <p className="orderStepHint">Wähle, wann deine Verteilung starten und bis wann sie abgeschlossen sein soll. Der früheste Start ist sieben Tage nach deiner Buchung.</p>
      <div className="dateGrid">
        <label>
          Frühester Start
          <input type="date" min={minimumStartDate} value={startDate} onChange={(event) => onStartDateChange(event.target.value)} />
        </label>
        <label>
          Spätestes Ende der Zustellung
          <input type="date" min={startDate} value={endDate} onChange={(event) => onEndDateChange(event.target.value)} />
        </label>
      </div>
      <label className="checkLine">
        <input type="checkbox" checked={flexibleScheduling} onChange={(event) => onFlexibleSchedulingChange(event.target.checked)} />
        Ich bin beim Zeitraum flexibel
      </label>
    </section>
  );
}
