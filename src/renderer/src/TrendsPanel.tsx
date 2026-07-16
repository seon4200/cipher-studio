import { useState } from 'react';
import { X, TrendingUp, Music, Sparkles, MessageSquare } from 'lucide-react';

interface TrendsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TrendsPanel({ isOpen, onClose }: TrendsPanelProps) {
  const [activeTab, setActiveTab] = useState<'topics' | 'sounds' | 'hooks'>('topics');

  if (!isOpen) return null;

  const topics = [
    { title: 'IA y Automatización', growth: '+142%', category: 'Tecnología', viralScore: 98, description: 'Cómo usar herramientas de IA para optimizar flujos de trabajo diarios.' },
    { title: 'Estilo de Vida Minimalista', growth: '+89%', category: 'Bienestar', viralScore: 85, description: 'Organización del hogar, productividad y reducción de estrés.' },
    { title: 'Finanzas Personales en 2026', growth: '+120%', category: 'Finanzas', viralScore: 92, description: 'Estrategias de inversión sencillas y ahorro en tiempos de inflación.' },
    { title: 'Recetas en 5 Minutos', growth: '+75%', category: 'Cocina', viralScore: 88, description: 'Comidas rápidas, saludables y estéticas para plataformas verticales.' }
  ];

  const sounds = [
    { title: 'Cyberpunk Retro Synth', artist: 'Neon Horizon', duration: '0:15', viralScore: 95, useCount: '45.2K videos' },
    { title: 'Lo-Fi Chill Study Beat', artist: 'Café Beats', duration: '0:30', viralScore: 89, useCount: '28.1K videos' },
    { title: 'Uplifting Ambient Piano', artist: 'Aura Music', duration: '0:20', viralScore: 91, useCount: '34.7K videos' },
    { title: 'Techno Phonk Blast', artist: 'Distortion X', duration: '0:12', viralScore: 97, useCount: '62.4K videos' }
  ];

  const hooks = [
    { text: '“Esto es lo que las grandes marcas no quieren que sepas…”', type: 'Intriga', performance: 'Excelente (94%)' },
    { text: '“El error número 1 que cometes al intentar hacer…”', type: 'Educativo', performance: 'Muy Alto (89%)' },
    { text: '“Dejé de hacer X durante 30 días y esto fue lo que pasó…”', type: 'Desafío', performance: 'Excelente (92%)' },
    { text: '“3 herramientas gratuitas que se sienten ilegales de conocer…”', type: 'Lista', performance: 'Viral (96%)' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex overflow-hidden font-sans">
      {/* Background backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-md bg-[#1C1C1E] border-r border-[#3a3a3c] h-full flex flex-col shadow-2xl animate-in slide-in-from-left duration-300">
        
        {/* Header */}
        <div className="p-4 border-b border-[#3a3a3c] flex items-center justify-between bg-[#1C1C1E]/90 bg-zinc-900">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-rose-500" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Tendencias Virales</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-[#3a3a3c] rounded-md text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex p-2 border-b border-[#3a3a3c] bg-[#111112]">
          {[
            { id: 'topics', label: 'Temas', icon: Sparkles },
            { id: 'sounds', label: 'Audios', icon: Music },
            { id: 'hooks', label: 'Ganchos', icon: MessageSquare }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                  activeTab === tab.id
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#3a3a3c]/40'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === 'topics' && (
            <div className="space-y-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">Temas con alto crecimiento de búsquedas</p>
              {topics.map((topic, i) => (
                <div key={i} className="p-3 bg-[#0D0D0F]/60 border border-[#3a3a3c]/60 rounded-xl hover:border-rose-500/30 transition-all group">
                  <div className="flex justify-between items-start mb-1.5">
                    <div>
                      <span className="text-[9px] font-bold text-rose-400 uppercase bg-rose-500/10 px-1.5 py-0.5 rounded-md mr-2">{topic.category}</span>
                      <span className="text-[10px] font-bold text-emerald-400">{topic.growth}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium">Score Viral: <span className="text-white font-bold">{topic.viralScore}</span></div>
                  </div>
                  <h3 className="text-xs font-bold text-white mb-1 group-hover:text-rose-400 transition-colors">{topic.title}</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{topic.description}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'sounds' && (
            <div className="space-y-2">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">Audios recomendados para videos cortos</p>
              {sounds.map((sound, i) => (
                <div key={i} className="p-3 bg-[#0D0D0F]/60 border border-[#3a3a3c]/60 rounded-xl hover:border-rose-500/30 transition-all flex items-center justify-between group">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-rose-500/10 rounded-lg flex items-center justify-center text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-all cursor-pointer">
                      <Music className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white truncate max-w-[180px]">{sound.title}</h4>
                      <p className="text-[10px] text-slate-500">{sound.artist} · {sound.duration}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 font-semibold">{sound.useCount}</div>
                    <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1 py-0.2 rounded-md">🔥 Top {i+1}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'hooks' && (
            <div className="space-y-2.5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">Frases iniciales para retener retención</p>
              {hooks.map((hook, i) => (
                <div key={i} className="p-3 bg-[#0D0D0F]/60 border border-[#3a3a3c]/60 rounded-xl hover:border-rose-500/30 transition-all group">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[9px] font-bold text-indigo-400 uppercase bg-indigo-500/10 px-1.5 py-0.5 rounded-md">{hook.type}</span>
                    <span className="text-[10px] text-emerald-400 font-bold">{hook.performance}</span>
                  </div>
                  <p className="text-xs text-white italic font-medium leading-relaxed group-hover:text-rose-300 transition-colors">{hook.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-[#3a3a3c] bg-[#111112] text-center">
          <button 
            onClick={onClose}
            className="w-full py-2 rounded-xl bg-[#1C1C1E] border border-[#3a3a3c] text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-500 transition-all"
          >
            Cerrar panel
          </button>
        </div>

      </div>
    </div>
  );
}
