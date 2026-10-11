import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { DirectorAuthState, DirectorModelOption, DirectorProviderId } from '../../../shared/director-provider';

export interface DirectorAvailability { ready: boolean; reason: string }
interface Props {
  providerId: DirectorProviderId;
  modelId: string;
  onProviderChange: (provider: DirectorProviderId) => void;
  onModelChange: (model: string) => void;
  onAccountChange: (profileId: string | null) => void;
  onAvailabilityChange: (value: DirectorAvailability) => void;
  refreshToken?: number;
  disabled?: boolean;
}

export function DirectorSettingsPanel(props: Props) {
  const { providerId, modelId, onProviderChange, onModelChange, onAccountChange, onAvailabilityChange } = props;
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return typeof window === 'undefined' || window.localStorage.getItem('cipher_director_panel_collapsed_v1') !== 'false';
    } catch { return true; }
  });
  const [auth, setAuth] = useState<DirectorAuthState | null>(null);
  const [models, setModels] = useState<DirectorModelOption[]>([]);
  const [deepseekConfigured, setDeepseekConfigured] = useState(false);
  const [targetProfileId, setTargetProfileId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const activeProfile = auth?.profiles.find(profile => profile.id === auth.activeProfileId) || null;
  const listedModel = models.find(model => model.slug === modelId);

  useEffect(() => {
    try { window.localStorage.setItem('cipher_director_panel_collapsed_v1', String(collapsed)); }
    catch { /* The panel remains usable when browser storage is unavailable. */ }
  }, [collapsed]);

  const refresh = useCallback(async (preferProfileId?: string | null) => {
    setLoading(true);
    try {
      const stateResult = await window.electronAPI.getDirectorState();
      if (!stateResult.success || !stateResult.state) throw new Error(stateResult.error || 'No se pudo leer el estado del director.');
      let next = stateResult.state;
      setDeepseekConfigured(!!stateResult.deepseekConfigured);
      const requestedId = preferProfileId === undefined ? next.activeProfileId : preferProfileId;
      if (requestedId && requestedId !== next.activeProfileId) {
        const chosen = await window.electronAPI.selectDirectorAccount(requestedId);
        if (chosen.success && chosen.state) next = chosen.state;
      }
      setAuth(next);
      setTargetProfileId('');
      onAccountChange(next.activeProfileId);
      if (providerId === 'chatgpt' && next.activeProfileId) {
        const catalog = await window.electronAPI.getDirectorModels(next.activeProfileId);
        setModels(catalog.success ? catalog.models || [] : []);
        if (!catalog.success) setError(catalog.error || 'No se pudo consultar el catálogo de modelos.');
        else setError('');
      } else setModels([]);
    } catch (e: any) { setError(e?.message || 'No se pudo comprobar el director.'); }
    finally { setLoading(false); }
  }, [onAccountChange, providerId]);

  useEffect(() => { void refresh(); }, [refresh]);

  // A completed direction run only refreshes safe SIWC metadata; it never refreshes
  // the model catalog, reconnects an account, or starts another request.
  useEffect(() => {
    if (props.refreshToken === undefined || props.refreshToken === 0) return;
    let cancelled = false;
    void window.electronAPI.getDirectorState().then(result => {
      if (cancelled) return;
      if (result.success && result.state) {
        setAuth(result.state);
        setDeepseekConfigured(!!result.deepseekConfigured);
      } else if (result.error) setError(result.error);
    }).catch((cause: any) => {
      if (!cancelled) setError(cause?.message || 'No se pudo actualizar el estado del director.');
    });
    return () => { cancelled = true; };
  }, [props.refreshToken]);

  const availability = useMemo<DirectorAvailability>(() => {
    if (loading) return { ready: false, reason: 'Comprobando proveedor y modelo.' };
    if (providerId === 'deepseek') {
      if (!deepseekConfigured) return { ready: false, reason: 'DeepSeek no está configurado en el entorno de Cipher.' };
      if (modelId !== 'deepseek-chat') return { ready: false, reason: 'Elige el modelo implementado de DeepSeek.' };
      return { ready: true, reason: '' };
    }
    if (providerId === 'chatgpt') {
      if (!activeProfile?.connected) return { ready: false, reason: 'Conecta una cuenta de ChatGPT.' };
      if (!activeProfile.planUsageEnabled) return { ready: false, reason: 'Autoriza el permiso de uso de tu plan en ChatGPT.' };
      if (!models.length) return { ready: false, reason: error || 'No hay modelos disponibles para esta cuenta.' };
      if (!modelId) return { ready: false, reason: 'Selecciona un modelo de ChatGPT.' };
      if (!listedModel) return { ready: false, reason: 'El modelo guardado no está disponible; elige uno del catálogo actual.' };
      return { ready: true, reason: '' };
    }
    return { ready: false, reason: 'Este proveedor todavía no está conectado.' };
  }, [activeProfile, deepseekConfigured, error, listedModel, loading, modelId, models.length, providerId]);

  useEffect(() => { onAvailabilityChange(availability); }, [availability, onAvailabilityChange]);

  const handleConnect = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await window.electronAPI.connectDirectorAccount(targetProfileId || undefined);
      if (result.state) setAuth(result.state);
      if (!result.success) setError(result.error || 'No se pudo conectar ChatGPT.');
      if (result.state?.activeProfileId) await refresh(result.state.activeProfileId);
    } catch (e: any) { setError(e?.message || 'No se pudo conectar ChatGPT.'); }
    finally { setBusy(false); }
  };

  const handleCancel = async () => {
    await window.electronAPI.cancelDirectorLogin();
    setNotice('Se solicitó cancelar el inicio de sesión.');
  };

  const handleProfileChange = async (profileId: string) => {
    setError(''); setNotice(''); setModels([]);
    const profile = auth?.profiles.find(item => item.id === profileId);
    if (!profileId) { setTargetProfileId(''); return; }
    if (profile && !profile.connected) { setTargetProfileId(profileId); return; }
    setBusy(true);
    try {
      const result = await window.electronAPI.selectDirectorAccount(profileId);
      if (!result.success || !result.state) throw new Error(result.error || 'No se pudo seleccionar la cuenta.');
      setAuth(result.state); setTargetProfileId(''); onAccountChange(result.state.activeProfileId);
      if (providerId === 'chatgpt') {
        const catalog = await window.electronAPI.getDirectorModels(profileId);
        if (catalog.success) setModels(catalog.models || []);
        else setError(catalog.error || 'No se pudo actualizar el catálogo.');
      }
    } catch (e: any) { setError(e?.message || 'No se pudo seleccionar la cuenta.'); }
    finally { setBusy(false); }
  };

  const handleDisconnect = async () => {
    if (!activeProfile) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await window.electronAPI.disconnectDirectorAccount(activeProfile.id);
      if (!result.success || !result.state) throw new Error(result.error || 'No se pudo desconectar la cuenta.');
      setAuth(result.state); setModels([]); onAccountChange(null);
      setNotice(result.revocationConfirmed ? 'Cuenta desconectada y sesión revocada.' : 'Cuenta desconectada localmente. ChatGPT no confirmó la revocación; puedes retirarla también desde sus ajustes.');
    } catch (e: any) { setError(e?.message || 'No se pudo desconectar la cuenta.'); }
    finally { setBusy(false); }
  };

  const statusText = loading ? 'Comprobando…' : providerId === 'deepseek'
    ? (deepseekConfigured ? 'Configurado en este entorno' : 'Sin configurar')
    : providerId === 'chatgpt'
      ? activeProfile
        ? activeProfile.planUsageEnabled ? 'Cuenta conectada · permiso de plan concedido' : 'Cuenta conectada · falta permiso de plan'
        : 'Cuenta sin conectar'
      : 'Integración pendiente';
  const providerLabel = providerId === 'chatgpt' ? 'ChatGPT'
    : providerId === 'deepseek' ? 'DeepSeek'
      : providerId === 'anthropic' ? 'Claude' : 'Gemini';
  const modelLabel = listedModel?.displayName || (providerId === 'deepseek' && modelId === 'deepseek-chat'
    ? 'DeepSeek Chat' : modelId ? (loading ? modelId : 'Modelo no disponible') : 'Sin modelo');
  const connectionSummary = loading ? 'Comprobando…' : providerId === 'chatgpt'
    ? activeProfile?.connected
      ? activeProfile.planUsageEnabled ? 'Conectado' : 'Falta permiso'
      : 'Sin conectar'
    : providerId === 'deepseek' ? deepseekConfigured ? 'Configurado' : 'Sin configurar' : 'Pendiente';
  const last = auth?.lastInference;

  return <section className="mx-2 my-2 rounded-xl border border-[#3a3a3c] bg-[#151517] overflow-hidden">
    <button type="button" aria-expanded={!collapsed} aria-controls="director-settings-details"
      onClick={() => setCollapsed(value => !value)}
      className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500">
      <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-300">Director del montaje</span>
        {collapsed && <span className="block truncate text-[9px] text-slate-400" title={`${providerLabel} · ${modelLabel} · ${connectionSummary}`}>
          {providerLabel} · {modelLabel} · {connectionSummary}
        </span>}
      </span>
    </button>
    {collapsed && !!error && <div role="alert" className="px-3 pb-2 text-[9px] leading-snug text-rose-300 break-words">{error}</div>}
    <div id="director-settings-details" hidden={collapsed} className="px-3 pb-3 space-y-2.5">
    <label className="block space-y-1">
      <span className="text-[9px] text-slate-500">Proveedor del director</span>
      <select value={providerId} disabled={props.disabled} onChange={e => onProviderChange(e.target.value as DirectorProviderId)}
        className="w-full rounded-md border border-[#3a3a3c] bg-[#1c1c1e] px-2 py-1.5 text-[10px] text-slate-200">
        <option value="chatgpt">ChatGPT · Sign in with ChatGPT</option>
        <option value="deepseek">DeepSeek</option>
        <option value="anthropic" disabled>Claude · próximamente</option>
        <option value="gemini" disabled>Gemini · próximamente</option>
      </select>
    </label>
    <label className="block space-y-1">
      <span className="text-[9px] text-slate-500">Modelo del proveedor</span>
      <select value={modelId} disabled={props.disabled || loading || (providerId === 'chatgpt' && models.length === 0)}
        onChange={e => onModelChange(e.target.value)}
        className="w-full rounded-md border border-[#3a3a3c] bg-[#1c1c1e] px-2 py-1.5 text-[10px] text-slate-200">
        {!modelId && <option value="">Selecciona un modelo</option>}
        {modelId && !listedModel && <option value={modelId}>No disponible: {modelId}</option>}
        {providerId === 'deepseek' && <option value="deepseek-chat">DeepSeek Chat · deepseek-chat</option>}
        {providerId === 'chatgpt' && models.map(model => <option key={model.slug} value={model.slug}>{model.displayName} · {model.slug}</option>)}
        {providerId === 'anthropic' && <option value="">Claude todavía no está conectado</option>}
        {providerId === 'gemini' && <option value="">Gemini todavía no está conectado</option>}
      </select>
    </label>
    <div className="text-[9px] text-slate-400">{statusText}</div>
    {providerId === 'chatgpt' && <>
      <label className="block space-y-1">
        <span className="text-[9px] text-slate-500">Cuenta ChatGPT</span>
        <select value={targetProfileId || auth?.activeProfileId || ''} disabled={busy || loading}
          onChange={e => void handleProfileChange(e.target.value)}
          className="w-full rounded-md border border-[#3a3a3c] bg-[#1c1c1e] px-2 py-1.5 text-[10px] text-slate-200">
          <option value="">Selecciona cuenta</option>
          {auth?.profiles.map(profile => <option key={profile.id} value={profile.id}>
            {profile.email}{profile.connected ? '' : ' · desconectada'}
          </option>)}
        </select>
      </label>
      {activeProfile && <div className="text-[9px] text-slate-500">Cuenta activa: <span className="text-slate-300">{activeProfile.email}</span></div>}
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => void handleConnect()}
          className="flex-1 rounded-md bg-indigo-600 px-2 py-1.5 text-[9px] font-semibold text-white disabled:opacity-50">
          {busy ? 'Conectando…' : activeProfile?.planUsageEnabled ? 'Añadir cuenta' : activeProfile ? 'Autorizar / reconectar' : targetProfileId ? 'Reconectar cuenta' : 'Conectar con ChatGPT'}
        </button>
        {busy && <button type="button" onClick={() => void handleCancel()} className="rounded-md border border-slate-600 px-2 py-1.5 text-[9px] text-slate-200">Cancelar</button>}
        {activeProfile && <button type="button" disabled={busy} onClick={() => void handleDisconnect()}
          className="rounded-md border border-slate-600 px-2 py-1.5 text-[9px] text-slate-200 disabled:opacity-50">Desconectar</button>}
      </div>
      {auth?.profiles.length ? <div className="text-[9px] text-slate-500">{models.length} modelos visibles para la cuenta seleccionada. El catálogo se actualiza al cambiar de cuenta.</div> : null}
      {last ? <div className="text-[9px] text-slate-500 break-words">
        Última solicitud global (no acredita el origen de este plan): {{ completed: 'respuesta recibida', failed: 'fallida', cancelled: 'cancelada' }[last.status || 'completed']} · solicitado {last.model}
        {last.actualModelId ? ` · devuelto ${last.actualModelId}` : ''} · {new Date(last.completedAt).toLocaleString()} · {last.durationMs} ms
        {last.totalTokens !== undefined ? ` · ${last.totalTokens} tokens` : ' · uso no informado'}
        {last.providerRequestId ? ` · solicitud ${last.providerRequestId}` : ''}
        {last.providerResponseId ? ` · respuesta ${last.providerResponseId}` : ''}
        {last.errorCode ? ` · ${last.errorCode}` : ''}
      </div> : <div className="text-[9px] text-slate-500">Última solicitud global: sin registro.</div>}
    </>}
    {providerId === 'deepseek' && <div className="text-[9px] text-slate-500">Modelo configurado: deepseek-chat.</div>}
    {!availability.ready && availability.reason && <div className="text-[9px] text-amber-300">{availability.reason}</div>}
    {!!error && <div role="alert" className="text-[9px] text-rose-300">{error}</div>}
    {!!notice && <div className="text-[9px] text-emerald-300">{notice}</div>}
    {providerId === 'chatgpt' && <a href="https://chatgpt.com/#settings/Usage" target="_blank" rel="noreferrer" className="block text-[9px] text-indigo-300 underline">Revisar uso y permisos en ChatGPT</a>}
    </div>
  </section>;
}
