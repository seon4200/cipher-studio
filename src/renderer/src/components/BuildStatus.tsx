import type { BuildSummary } from '../../../shared/build-plan';

export function BuildStatus({ summary, busy, canContinue, reason, error, onContinue, onPlanOnly, onCancel }: {
  summary: BuildSummary | null; busy: boolean; canContinue: boolean; reason: string; error: string;
  onContinue: () => void; onPlanOnly: () => void; onCancel: () => void;
}) {
  const originStatus = summary?.directionOriginStatus || 'unrecorded';
  const providerLabel = (id: string) => id === 'chatgpt' ? 'ChatGPT' : id === 'deepseek' ? 'DeepSeek' : id;
  const attemptLabel = (result: string) => ({ running: 'en curso', completed: 'completada', failed: 'fallida',
    cancelled: 'cancelada', interrupted: 'interrumpida' } as Record<string, string>)[result] || result;
  return <div className="mt-3 rounded-xl border border-slate-700 p-3 text-xs text-slate-300 space-y-2" aria-live="polite">
    <p>Mezcla por tiempo de pantalla · clips de 2–3 s · IA en 0 % durante esta entrega.</p>
    {summary && <>
      <p>{summary.completed}/{summary.total} clips guardados · {
        { ready: 'Plan listo; medios pendientes', running: 'En ejecución', paused: 'Pausado', incomplete: 'Pendiente', complete: 'Montaje completo' }[summary.status]}</p>
      <p>Plan: Stock {summary.stockSeconds.toFixed(2)} s / Original {summary.originalSeconds.toFixed(2)} s.
        Stock obtenido: {summary.obtainedStockSeconds.toFixed(2)} s.</p>
      {summary.allocationMessage && <p className="text-amber-300">{summary.allocationMessage}</p>}
      <details>
        <summary className="cursor-pointer text-slate-400">Origen de la dirección</summary>
        {originStatus === 'unrecorded'
          ? <p className="mt-1">Origen no registrado. Este plan es anterior al registro de proveedor y modelo.</p>
          : originStatus === 'not-required'
            ? <p className="mt-1">No se necesitó una solicitud de dirección para este plan.</p>
            : <>
              <p className="mt-1">Estado: {originStatus === 'recorded' ? 'registrado' : originStatus === 'partial' ? 'parcial' : 'pendiente'}.</p>
              <ul className="mt-1 space-y-1">{summary.directionAttempts.map(attempt =>
                <li key={attempt.id}>
                  {providerLabel(attempt.providerId)} · solicitado {attempt.requestedModelId}
                  {attempt.actualModelId ? ` · devuelto ${attempt.actualModelId}` : ''}
                  {attempt.providerRequestId ? ` · solicitud ${attempt.providerRequestId}` : ''}
                  {attempt.providerResponseId ? ` · respuesta ${attempt.providerResponseId}` : ''}
                  {` · ${attemptLabel(attempt.result)} · ${new Date(attempt.startedAt).toLocaleString()}`}
                  {attempt.endedAt ? `–${new Date(attempt.endedAt).toLocaleTimeString()}` : ''}
                  {attempt.error ? ` · ${attempt.error.code}` : ''}
                </li>)}</ul>
            </>}
      </details>
      {summary.pending.some(s => s.error || s.stockReviewRequired) && <details>
        <summary className="cursor-pointer text-amber-300">Escenas que necesitan atención</summary>
        <ul className="space-y-1 mt-2">{summary.pending.filter(s => s.error || s.stockReviewRequired).map(s =>
          <li key={s.id}>{s.id.slice(-6)} · {s.category}: {s.error?.message || 'Requiere atención.'}
            {s.stockReviewRequired && <span className="block text-slate-400">Pertinencia Stock pendiente de revisión; candidatos: {
              s.stockReviewCandidates?.length ? s.stockReviewCandidates.join(', ') : 'sin candidatos con metadatos suficientes'}. No se sustituyó por Original.</span>}
          </li>)}</ul>
      </details>}
      {!busy && <button disabled={!canContinue} onClick={onContinue}
        className="rounded bg-emerald-800 px-3 py-2 disabled:opacity-40">
        {summary.status === 'complete' ? 'Restaurar montaje guardado' : summary.status === 'ready' ? 'Construir medios pendientes' : 'Continuar pendientes'}
      </button>}
    </>}
    {!busy && <button disabled={!canContinue} onClick={onPlanOnly}
      className="rounded border border-indigo-500 px-3 py-2 text-indigo-200 disabled:opacity-40">
      Solo planificar
    </button>}
    {busy && <button onClick={onCancel} className="rounded bg-slate-700 px-3 py-2">Cancelar y conservar avance</button>}
    {!busy && reason && <p className="text-amber-300">{reason}</p>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
  </div>;
}
