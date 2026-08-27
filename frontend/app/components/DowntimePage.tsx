"use client";

export default function DowntimePage() {
  return (
    <div className="nawab-downtime" role="status" aria-live="polite">
      <div className="nawab-downtime__card">
        <span className="nawab-downtime__dot" aria-hidden="true" />
        <h1 className="nawab-downtime__title">Nawab AI is resting</h1>
        <p className="nawab-downtime__body">
          We can&rsquo;t reach the palace right now. Reconnecting automatically&hellip;
        </p>
      </div>
    </div>
  );
}
