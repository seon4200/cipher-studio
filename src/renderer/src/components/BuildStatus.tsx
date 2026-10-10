import type { BuildSummary } from '../../../shared/build-plan';

export function BuildStatus({ summary, busy, canContinue, reason, error, onContinue, onCancel }: {
  summary: BuildSummary | null; busy: boolean; canContinue: boolean; reason: string; error: string;
  onContinue: () => void; onCancel: () => void;
}) {
  return <div className="mt-3 rounded-xl border border-slate-700 p-3 text-xs text-slate-300 space-y-2" aria-live="polite">
    <p>Mezcla por tiempo de pantalla · clips de 2–3 s · IA en 0 % durante esta entrega.</p>
    {summary && <>
      <p>{summary.completed}/{summary.total} clips guardados · {
        { ready: 'Plan preparado', running: 'En ejecución', paused: 'Pausado', incomplete: 'Pendiente', complete: 'Medios completos' }[summary.status]}</p>
      <p>Plan: Stock {summary.stockSeconds.toFixed(2)} s / Original {summary.originalSeconds.toFixed(2)} s.
        Stock obtenido: {summary.obtainedStockSeconds.toFixed(2)} s.</p>
      {summary.allocationMessage && <p className="text-amber-300">{summary.allocationMessage}</p>}
      {summary.pending.some(s => s.error) && <details>
        <summary className="cursor-pointer text-amber-300">Escenas que necesitan atención</summary>
        <ul className="space-y-1 mt-2">{summary.pending.filter(s => s.error).map(s =>
          <li key={s.id}>{s.id.slice(-6)} · {s.category}: {s.error!.message}</li>)}</ul>
      </details>}
      {!busy && <button disabled={!canContinue} onClick={onContinue}
        className="rounded bg-emerald-800 px-3 py-2 disabled:opacity-40">
        {summary.status === 'complete' ? 'Restaurar montaje guardado' : 'Continuar pendientes'}
      </button>}
    </>}
    {busy && <button onClick={onCancel} className="rounded bg-slate-700 px-3 py-2">Cancelar y conservar avance</button>}
    {!busy && reason && <p className="text-amber-300">{reason}</p>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
  </div>;
}
