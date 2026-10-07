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
  version: "4.0",
  defaultStyle: "editorial_object_collage",
  styles: {
    editorial_object_collage: {
      label: "COLLAGE EDITORIAL FOTOGRÁFICO DE PAPEL",
      enabled: true,
      description: "Collage editorial fotográfico adulto y explicativo, vertical 9:16. Fotografía predominantemente en blanco y negro, con detalle reconocible y contraste claro, montada sobre papel marfil, naranja quemado, teal apagado o azul marino. Textura de impresión discreta, bordes blancos naturales estrechos o moderados y sombras cortas de papel, sin objetos 3D flotantes. Variar posición, escala, encuadre, composición y recursos de montaje según la idea. Cada apoyo debe aclarar una relación. Sin personas, caras, manos, siluetas humanas, texto legible, números, etiquetas, logotipos solicitados, plantas, juguetes, iconos 3D brillantes ni protagonista vectorial. El servicio puede añadir su propia marca de agua.",
      techniques: {
        photographic_paper_cutout: {
          label: "Objeto fotográfico recortado en papel",
          promptFragment: "editorial black-and-white photography with crisp recognizable detail, a natural narrow or moderate white paper edge, and a short shallow paper shadow"
        }
      },
      colorPalette: {
        marfil: { hex: "#F2EBDD", emotion: ["claridad", "documental"] },
        azul_marino: { hex: "#10253B", emotion: ["seriedad", "análisis"] },
        naranja_quemado: { hex: "#C85B32", emotion: ["énfasis", "energía"] },
        teal_apagado: { hex: "#477C78", emotion: ["contexto", "documental"] }
      },
      metaphors: {},
      promptTemplate: "{conceptLabel}. Main photographic image: {object}, sharply defined and placed according to the idea. Add only the supporting elements needed to explain the scene and make their visual relationship clear. Editorial black-and-white photographic paper collage, 9:16, using a varied composition, one suitable paper background color, discreet print grain, natural white cut edges and short paper shadows. Mature explanatory art direction. No people, human silhouettes, readable text, numbers, labels, requested logos or unrelated decoration.",
      fallbackRule: {
        defaultTechnique: "photographic_paper_cutout",
        defaultColor: "marfil"
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
  const textToUse = baseText && baseText.trim() ? baseText.trim() : 'editorial scene';

  // 1. Obtener estilo configurado con fallback a defaultStyle si está deshabilitado
  let styleKey = iaStyle || guide.defaultStyle || 'editorial_object_collage';
  let styleConf = guide.styles?.[styleKey];

  if (!styleConf || styleConf.enabled === false) {
    console.log(`[stylePromptBuilder] Fallback de estilo a "${guide.defaultStyle}" (solicitado: "${styleKey}" no existe o está inactivo)`);
    styleKey = guide.defaultStyle || 'editorial_object_collage';
    styleConf = guide.styles?.[styleKey];
  }

  // Si falló toda resolución (por ejemplo, archivo vacío), usamos el de respaldo
  if (!styleConf) {
    styleConf = DEFAULT_GUIDE_FALLBACK.styles.editorial_object_collage;
  }

  let imagePrompt = '';
  const videoPrompt = `Use the supplied image as a frozen background. The main photographic objects and every existing element stay exactly unchanged.\n\nOne relevant supporting graphic that explains ${textToUse} appears or slides in and stops.\n\nMatch the new element to the original image style. No other motion. Fixed camera.`;

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
  const defaultTech = styleConf.fallbackRule?.defaultTechnique || 'photographic_paper_cutout';
  const defaultCol = styleConf.fallbackRule?.defaultColor || 'marfil';

  if (bestMatch) {
    // 4. Match directo encontrado
    const techFragment = styleConf.techniques?.[bestMatch.technique]?.promptFragment || 
                         styleConf.techniques?.[defaultTech]?.promptFragment || '';
    const colorHex = styleConf.colorPalette?.[bestMatch.colorSuggestion]?.hex || 
                     styleConf.colorPalette?.[defaultCol]?.hex || '';

    const template = styleConf.promptTemplate || 
                     "{conceptLabel}. Main photographic image: {object}, sharply defined and placed according to the idea. Add only the supporting elements needed to explain the scene and make their visual relationship clear. Editorial black-and-white photographic paper collage, 9:16, using a varied composition, one suitable paper background color, discreet print grain, natural white cut edges and short paper shadows. Mature explanatory art direction. No people, human silhouettes, readable text, numbers, labels, requested logos or unrelated decoration.";

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
                     "{conceptLabel}. Main photographic image: {object}, sharply defined and placed according to the idea. Add only the supporting elements needed to explain the scene and make their visual relationship clear. Editorial black-and-white photographic paper collage, 9:16, using a varied composition, one suitable paper background color, discreet print grain, natural white cut edges and short paper shadows. Mature explanatory art direction. No people, human silhouettes, readable text, numbers, labels, requested logos or unrelated decoration.";

    imagePrompt = template
      .replace('{techniquePromptFragment}', techFragment)
      .replace('{object}', 'one or two photographic objects related to the topic')
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
