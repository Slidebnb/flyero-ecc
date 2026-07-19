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
      <p className="orderStepHint">Wähle deinen Zeitraum. Der früheste Start ist sieben Tage nach deiner Buchung.</p>
      <div className="dateGrid">
        <label>
          Frühester möglicher Start
          <input type="date" min={minimumStartDate} value={startDate} onChange={(event) => onStartDateChange(event.target.value)} />
        </label>
        <label>
          Spätestes Zustelldatum
          <input type="date" min={startDate} value={endDate} onChange={(event) => onEndDateChange(event.target.value)} />
        </label>
      </div>
      <label className="checkLine">
        <input type="checkbox" checked={flexibleScheduling} onChange={(event) => onFlexibleSchedulingChange(event.target.checked)} />
        Zeitraum flexibel abstimmen
      </label>
    </section>
  );
}
