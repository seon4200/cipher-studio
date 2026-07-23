import fs from 'fs';
import path from 'path';

export interface GuideStyleDetail {
  label: string;
  enabled: boolean;
  description: string;
  techniques?: Record<string, { label: string; promptFragment: string }>;
  colorPalette?: Record<string, { hex: string; emotion: string[] }>;
  metaphors?: Record<string, Array<{
    concept: string;
    conceptLabel: string;
    keywords: string[];
    object: string;
    technique: string;
    colorSuggestion: string;
  }>>;
  promptTemplate?: string;
  fallbackRule?: {
    defaultTechnique: string;
    defaultColor: string;
  };
  promptFragment?: string; // Para estilos planos / deshabilitados
}

export interface StyleGuideConfig {
  version: string;
  defaultStyle: string;
  styles: Record<string, GuideStyleDetail>;
}

export interface StylePrompts {
  imagePrompt: string;
  videoPrompt: string;
}

let cachedGuide: StyleGuideConfig | null = null;

// Configuración robusta en memoria por si falla la lectura física del archivo
const DEFAULT_GUIDE_FALLBACK: StyleGuideConfig = {
  version: "2.0",
  defaultStyle: "motion_graphics",
  styles: {
    motion_graphics: {
      label: "Motion Graphics Editorial",
      enabled: true,
      description: "Ilustración editorial fotográfica: una imagen = una metáfora visual clara, sin texto, leíble en menos de 2 segundos.",
      techniques: {
        silueta_plana: {
          label: "silueta plana negra",
          promptFragment: "silueta plana negra vectorial, sin rasgos faciales, recorte limpio tipo papel"
        }
      },
      colorPalette: {
        beige_papel: { hex: "#E8E0CF", emotion: ["introspeccion"] }
      },
      metaphors: {},
      promptTemplate: "{techniquePromptFragment} de {object} representando {conceptLabel}, sobre fondo {colorHex} sólido, sin texto, composición vertical 9:16, alto contraste, sin marcas de agua",
      fallbackRule: {
        defaultTechnique: "silueta_plana",
        defaultColor: "beige_papel"
      }
    }
  }
};

function loadStyleGuide(): StyleGuideConfig {
  if (cachedGuide) return cachedGuide;
  try {
    const possiblePaths = [
      path.join(process.cwd(), 'src/main/config/styleGuide.json'),
      path.join(process.cwd(), 'cipher-studio/src/main/config/styleGuide.json')
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        cachedGuide = JSON.parse(raw);
        return cachedGuide!;
      }
    }
  } catch (e) {
    console.error('[stylePromptBuilder] Error cargando styleGuide.json:', e);
  }
  return DEFAULT_GUIDE_FALLBACK;
}

// Normalización sin tildes y minúsculas
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function buildStylePrompt(baseText: string, iaStyle?: string): StylePrompts {
  const guide = loadStyleGuide();
  const textToUse = baseText && baseText.trim() ? baseText.trim() : 'cinematic scene';

  // 1. Obtener estilo configurado con fallback a defaultStyle si está deshabilitado
  let styleKey = iaStyle || guide.defaultStyle || 'motion_graphics';
  let styleConf = guide.styles?.[styleKey];

  if (!styleConf || styleConf.enabled === false) {
    console.log(`[stylePromptBuilder] Fallback de estilo a "${guide.defaultStyle}" (solicitado: "${styleKey}" no existe o está inactivo)`);
    styleKey = guide.defaultStyle || 'motion_graphics';
    styleConf = guide.styles?.[styleKey];
  }

  // Si falló toda resolución (por ejemplo, archivo vacío), usamos el de respaldo
  if (!styleConf) {
    styleConf = DEFAULT_GUIDE_FALLBACK.styles.motion_graphics;
  }

  let imagePrompt = '';
  const videoPrompt = `${textToUse}, smooth camera motion, subtle realistic animation`;

  // 2. Normalizar el texto de entrada para búsquedas
  const normalizedInput = normalizeText(textToUse);
  
  // 3. Buscar coincidencias en el diccionario de metáforas
  let bestMatch: {
    concept: string;
    conceptLabel: string;
    object: string;
    technique: string;
    colorSuggestion: string;
    matchedKeyword: string;
  } | null = null;

  if (styleConf.metaphors) {
    for (const categoryKey of Object.keys(styleConf.metaphors)) {
      const entries = styleConf.metaphors[categoryKey];
      if (Array.isArray(entries)) {
        for (const entry of entries) {
          if (Array.isArray(entry.keywords)) {
            for (const keyword of entry.keywords) {
              const normalizedKw = normalizeText(keyword);
              // Matchear por inclusión de substring
              if (normalizedInput.includes(normalizedKw)) {
                // Si ya hay coincidencia, prioriza la palabra clave más larga
                if (!bestMatch || normalizedKw.length > bestMatch.matchedKeyword.length) {
                  bestMatch = {
                    concept: entry.concept,
                    conceptLabel: entry.conceptLabel,
                    object: entry.object,
                    technique: entry.technique,
                    colorSuggestion: entry.colorSuggestion,
                    matchedKeyword: normalizedKw
                  };
                }
              }
            }
          }
        }
      }
    }
  }

  // Configuración de reglas por defecto de fallback
  const defaultTech = styleConf.fallbackRule?.defaultTechnique || 'silueta_plana';
  const defaultCol = styleConf.fallbackRule?.defaultColor || 'beige_papel';

  if (bestMatch) {
    // 4. Match directo encontrado
    const techFragment = styleConf.techniques?.[bestMatch.technique]?.promptFragment || 
                         styleConf.techniques?.[defaultTech]?.promptFragment || '';
    const colorHex = styleConf.colorPalette?.[bestMatch.colorSuggestion]?.hex || 
                     styleConf.colorPalette?.[defaultCol]?.hex || '';

    const template = styleConf.promptTemplate || 
                     "{techniquePromptFragment} de {object} representando {conceptLabel}, sobre fondo {colorHex} sólido, sin texto, composición vertical 9:16, alto contraste, sin marcas de agua";

    imagePrompt = template
      .replace('{techniquePromptFragment}', techFragment)
      .replace('{object}', bestMatch.object)
      .replace('{conceptLabel}', bestMatch.conceptLabel)
      .replace('{colorHex}', colorHex);

    console.log(`[stylePromptBuilder] Match directo encontrado para frase: "${textToUse}"`);
    console.log(` - Concepto ID: ${bestMatch.concept}`);
    console.log(` - Keyword Matcheada: "${bestMatch.matchedKeyword}"`);
    console.log(` - Objeto: ${bestMatch.object}`);
    console.log(` - Técnica: ${bestMatch.technique}`);
    console.log(` - Color Sugerido: ${bestMatch.colorSuggestion} (${colorHex})`);
  } else {
    // 5. Fallback por ausencia de metáforas
    const techFragment = styleConf.techniques?.[defaultTech]?.promptFragment || '';
    const colorHex = styleConf.colorPalette?.[defaultCol]?.hex || '';

    // Extraer primeras 8-10 palabras para usar de concepto natural
    const words = textToUse.trim().split(/\s+/);
    const shortLabel = words.slice(0, 10).join(' ');

    const template = styleConf.promptTemplate || 
                     "{techniquePromptFragment} de {object} representando {conceptLabel}, sobre fondo {colorHex} sólido, sin texto, composición vertical 9:16, alto contraste, sin marcas de agua";

    imagePrompt = template
      .replace('{techniquePromptFragment}', techFragment)
      .replace('{object}', 'una escena relacionada con el tema')
      .replace('{conceptLabel}', shortLabel)
      .replace('{colorHex}', colorHex);

    console.log(`[stylePromptBuilder] Fallback aplicado para frase: "${textToUse}"`);
    console.log(` - Técnica por defecto: ${defaultTech}`);
    console.log(` - Color por defecto: ${defaultCol} (${colorHex})`);
    console.log(` - Concepto recortado: "${shortLabel}"`);
  }

  return {
    imagePrompt,
    videoPrompt
  };
}
