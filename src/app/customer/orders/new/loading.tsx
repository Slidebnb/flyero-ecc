export default function CustomerOrderLoading() {
  return (
    <main className="orderExperienceShell orderExperienceLoading" aria-busy="true">
      <section className="orderLoadingPanel" role="status">
        <span className="orderLoadingKicker">FLYERO</span>
        <h1>Verteilung wird vorbereitet</h1>
        <p>Gebietsauswahl und Preisvorschau werden geladen.</p>
        <div className="orderLoadingProgress" aria-hidden="true"><span /></div>
        <small>Das dauert nur einen Moment.</small>
      </section>
    </main>
  );
}
