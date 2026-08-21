import { Page } from 'playwright-core';
import fs from 'fs';
import { getVideoDuration } from '../services/ffmpeg';

// Constantes y Selectores alineados con el sitio vibes.ai y el repositorio de referencia
const ComposerSelectors = {
  Input: '[data-lexical-editor="true"][contenteditable="true"]',
};

const GenerateButtonSelectors = {
  Video: 'button[data-analytics-id="send_message"][data-analytics-prompt-type="videos"]',
};

const StartEndFrameSelectors = {
  Toggle: 'button[data-analytics-id="creation_gallery.start_end_frame_selection_click"]',
};


// Tiempos de espera y límites
const MEDIA_POLL_INTERVAL_MS = 2000;
const MEDIA_STABILIZE_MS = 20000; // 20 segundos de espera para que se asiente el CDN de Meta
const MEDIA_POLL_MAX_ATTEMPTS = 150; // ~5 minutos máximo
const MAX_GENERATION_ATTEMPTS = 5;
const GENERATION_RETRY_DELAY_MS = 25000;

interface ReadyThumbnail {
  mediaId: string;
  batchId: string;
  index: number;
  url: string;
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

async function simulateClick(locator: any, page: Page) {
  await locator.click();
  // Pausa humana de 1.5 a 3 segundos después de cada clic para evitar rate limiting
  await page.waitForTimeout(1500 + Math.random() * 1500);
}

async function getCurrentMode(page: Page): Promise<'image' | 'video' | null> {
  const composer = page.locator(ComposerSelectors.Input);
  const label = stripAccents(
    (await composer.getAttribute('aria-label')) ||
    (await composer.getAttribute('title')) ||
    ''
  ).toLowerCase();

  if (label.includes('image')) return 'image';
  if (label.includes('video')) return 'video';
  return null;
}

async function ensureMode(page: Page, target: 'image' | 'video'): Promise<boolean> {
  const current = await getCurrentMode(page);
  if (current === target) return true;

  console.log(`[vibes-bot] Cambiando modo a: ${target}...`);
  const trigger = page.locator('button[aria-haspopup="menu"]').first();
  if (await trigger.count() === 0) return false;
  await simulateClick(trigger, page);

  const menu = page.locator('[role="menu"][data-state="open"]');
  await menu.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await menu.count() === 0) return false;

  const targetPrefix = target === 'image' ? 'ima' : 'vid';
  const menuItems = menu.locator('button[role="menuitem"]');
  const count = await menuItems.count();
  let found = false;

  for (let i = 0; i < count; i++) {
    const item = menuItems.nth(i);
    const text = stripAccents((await item.innerText()).toLowerCase());
    if (text.startsWith(targetPrefix)) {
      await simulateClick(item, page);
      found = true;
      break;
    }
  }

  if (!found) return false;

  // Esperar a que el modo cambie
  for (let i = 0; i < 20; i++) {
    if (await getCurrentMode(page) === target) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

async function ensureStartEndFramePanel(page: Page): Promise<boolean> {
  const addStartFrameBtn = page.locator('button').filter({ hasText: /Add start frame/i }).first();
  if (await addStartFrameBtn.count() > 0 && await addStartFrameBtn.isVisible()) {
    return true;
  }

  const toggle = page.locator(StartEndFrameSelectors.Toggle);
  if (await toggle.count() === 0) return false;
  await simulateClick(toggle, page);

  try {
    await addStartFrameBtn.waitFor({ state: 'visible', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function getGridImageCount(pickerDialog: any): Promise<number> {
  return await pickerDialog.locator('img[data-nimg="fill"]').count();
}

async function waitForStableCount(
  page: Page,
  pickerDialog: any,
  quietMs = 800,
  timeoutMs = 45000
): Promise<number> {
  const start = Date.now();
  let lastCount = await getGridImageCount(pickerDialog);
  let lastChangeAt = Date.now();

  while (Date.now() - start < timeoutMs) {
    await page.waitForTimeout(200);
    const count = await getGridImageCount(pickerDialog);
    if (count !== lastCount) {
      lastCount = count;
      lastChangeAt = Date.now();
    } else if (Date.now() - lastChangeAt >= quietMs) {
      return lastCount;
    }
  }
  return lastCount;
}

async function removeStartFrame(page: Page): Promise<void> {
  const btn = page.locator('button[aria-label="Remove start frame"], button[aria-label="Eliminar el marco de inicio"]').first();
  if (await btn.count() > 0 && await btn.isVisible()) {
    console.log('[vibes-bot] Limpiando start frame actual...');
    await simulateClick(btn, page);
  }
}

async function countGenerationErrors(page: Page): Promise<number> {
  return await page.locator('span').filter({ hasText: "Couldn't generate" }).count();
}

/**
 * Anima una imagen existente en Vibes AI.
 *
 * @param page Instancia de Page provista por Playwright desde la cola de control.
 * @param imagePath Ruta absoluta a la imagen generada por Nano Banana.
 * @param videoPrompt Prompt descriptivo para la animación de Vibes.
 * @param outputVideoPath Ruta absoluta donde se guardará el video final MP4 descargado.
 */
export async function animateImage(
  page: Page,
  imagePath: string,
  videoPrompt: string,
  outputVideoPath: string
): Promise<{ success: boolean; filePath?: string; error?: string; durationSeconds?: number }> {
  try {
    // 1. Verificación preliminar de navegación
    const currentUrl = page.url();
    if (!currentUrl.includes('vibes.ai')) {
      console.log('[vibes-bot] Navegando a vibes.ai...');
      await page.goto('https://vibes.ai/', { waitUntil: 'domcontentloaded' });
    } else {
      console.log('[vibes-bot] El navegador ya está en vibes.ai. Omitiendo navegación.');
    }

    // 2. Validación de Sesión / Login
    await page.waitForTimeout(2000); // Dar un momento para resolver renderizados
    const composer = page.locator(ComposerSelectors.Input).first();
    const isComposerVisible = await composer.isVisible().catch(() => false);

    if (!isComposerVisible) {
      const loginBtn = page.locator('button:has-text("Log in"), button:has-text("Sign in"), button:has-text("Iniciar sesión"), a:has-text("Iniciar sesión"), a:has-text("Log in")');
      if (await loginBtn.count() > 0) {
        console.error('[vibes-bot] Error: Sesión no activa (requiere iniciar sesión).');
        return { success: false, error: 'session_expired' };
      }
      try {
        await composer.waitFor({ state: 'visible', timeout: 8000 });
      } catch {
        console.error('[vibes-bot] Error: El editor de Vibes AI no cargó dentro de los 10 segundos.');
        return { success: false, error: 'editor_timeout' };
      }
    }

    // Asegurarse de limpiar cualquier start frame previo que haya quedado huérfano
    await removeStartFrame(page);

    // 3. Cambiar a modo video
    const switchedMode = await ensureMode(page, 'video');
    if (!switchedMode) {
      console.error('[vibes-bot] Error: No se pudo activar el modo de video.');
      return { success: false, error: 'mode_switch_failed' };
    }

    // 4. Asegurar panel de start frame y abrir modal de subida
    const panelReady = await ensureStartEndFramePanel(page);
    if (!panelReady) {
      console.error('[vibes-bot] Error: No se pudo desplegar el panel de start frame.');
      return { success: false, error: 'start_frame_panel_failed' };
    }

    const addStartBtn = page.locator('button').filter({ hasText: /Add start frame/i }).first();
    await simulateClick(addStartBtn, page);

    // Localizar el modal "Select start frame"
    const pickerDialog = page.locator('div').filter({
      has: page.locator('h1,h2,h3,span,div').filter({ hasText: /Select start frame|Seleccionar fotograma inicial/i })
    }).first();
    await pickerDialog.waitFor({ state: 'visible', timeout: 10000 });

    // Esperar a que la grilla inicial se estabilice y tomar baseline
    const baselineTotalImages = await waitForStableCount(page, pickerDialog);
    console.log(`[vibes-bot] Baseline de imágenes en grilla: ${baselineTotalImages}`);

    // Ir a la sección de subida (Upload)
    const uploadNavBtn = pickerDialog.locator('button').filter({ hasText: /Upload|Subir/i }).first();
    await simulateClick(uploadNavBtn, page);

    const uploadDialog = page.locator('div').filter({
      has: page.locator('h1,h2,h3,span,div').filter({ hasText: /Upload images|Cargar imágenes/i })
    }).first();
    await uploadDialog.waitFor({ state: 'visible', timeout: 10000 });

    // Inyectar el archivo de imagen en el input file
    const fileInput = uploadDialog.locator('input[type="file"]').first();
    await fileInput.setInputFiles(imagePath);

    // Delay de simulación para evitar bloqueos
    await page.waitForTimeout(2000 + Math.random() * 1500);

    // Confirmar subida
    const confirmBtn = uploadDialog.locator('button').filter({ hasText: /Upload|Subir/i }).first();
    await simulateClick(confirmBtn, page);

    // Esperar a retornar al picker dialog y monitorear el crecimiento de imágenes
    const pickerDialogAfter = page.locator('div').filter({
      has: page.locator('h1,h2,h3,span,div').filter({ hasText: /Select start frame|Seleccionar fotograma inicial/i })
    }).first();
    await pickerDialogAfter.waitFor({ state: 'visible', timeout: 10000 });

    console.log('[vibes-bot] Esperando a que finalice la subida de la imagen base...');
    let uploadSuccess = false;
    const deadline = Date.now() + 60000; // 1 minuto de timeout de subida
    
    while (Date.now() < deadline) {
      const currentImages = await getGridImageCount(pickerDialogAfter);
      if (currentImages > baselineTotalImages) {
        uploadSuccess = true;
        break;
      }
      
      const uploadFailedToast = page.locator('span').filter({ hasText: /Upload failed/i });
      if (await uploadFailedToast.count() > 0 && await uploadFailedToast.isVisible()) {
        console.error('[vibes-bot] Error: Se detectó toast "Upload failed".');
        break;
      }
      await page.waitForTimeout(1000);
    }

    if (!uploadSuccess) {
      console.error('[vibes-bot] Error: Expiró la espera de carga del archivo base o falló la subida.');
      return { success: false, error: 'upload_failed' };
    }

    console.log('[vibes-bot] Imagen cargada en grilla. Seleccionando tile...');
    // Seleccionar la primera miniatura recién subida en la grilla
    const firstTile = pickerDialogAfter.locator('img[data-nimg="fill"]').first().locator('xpath=..');
    await simulateClick(firstTile, page);

    // Esperar a que se habilite el botón "Add to video" y cliquearlo
    const addToVideoBtn = pickerDialogAfter.locator('button').filter({ hasText: /Add to video|Añadir al vídeo/i }).first();
    await addToVideoBtn.waitFor({ state: 'visible', timeout: 5000 });
    await simulateClick(addToVideoBtn, page);

    // 5. Inyectar prompts en el Composer
    console.log(`[vibes-bot] Inyectando videoPrompt: "${videoPrompt}"`);
    const finalComposer = page.locator(ComposerSelectors.Input).first();
    await finalComposer.focus();
    
    // Inyección atómica simulando Lexical pipeline
    await page.evaluate((text) => {
      document.execCommand('selectAll', false);
      document.execCommand('insertText', false, text);
    }, videoPrompt);
    
    await page.waitForTimeout(1300);

    // 6. Generar con reintentos
    const clickGenerate = async (): Promise<boolean> => {
      const currentText = await finalComposer.innerText();
      if (currentText.trim() !== videoPrompt.trim()) {
        await finalComposer.focus();
        await page.evaluate((text) => {
          document.execCommand('selectAll', false);
          document.execCommand('insertText', false, text);
        }, videoPrompt);
      }
      
      await page.waitForTimeout(1300);
      const generateBtn = page.locator(GenerateButtonSelectors.Video).first();
      if (await generateBtn.count() === 0 || await generateBtn.isDisabled()) {
        return false;
      }
      await simulateClick(generateBtn, page);
      return true;
    };

    // Tomamos baseline de imágenes listas de la galería antes de mandar la orden
    const beforeIds = new Set(await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-analytics-id="creation_gallery.thumbnail_click"]'));
      return cards.map(c => c.getAttribute('data-analytics-media-id') || '').filter(id => id !== '');
    }));

    let errorBaseline = await countGenerationErrors(page);
    let generationSuccess = false;
    let finalVideoUrl = '';

    for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
      console.log(`[vibes-bot] Intento de generación ${attempt}/${MAX_GENERATION_ATTEMPTS}...`);
      
      const clicked = await clickGenerate();
      if (!clicked) {
        console.error('[vibes-bot] Botón Generate no disponible o deshabilitado.');
        return { success: false, error: 'generate_button_disabled' };
      }

      // Polling de la galería para buscar el nuevo lote
      let batchMedia: ReadyThumbnail[] | null = null;
      for (let poll = 0; poll < MEDIA_POLL_MAX_ATTEMPTS; poll++) {
        await page.waitForTimeout(MEDIA_POLL_INTERVAL_MS);

        // Control de errores arrojados por el servidor
        const currentErrors = await countGenerationErrors(page);
        if (currentErrors > errorBaseline) {
          console.warn('[vibes-bot] Se detectó error "Couldn\'t generate" en la galería.');
          break;
        }

        // Obtener miniaturas listas
        const readyThumbs = await page.evaluate(() => {
          const cards = Array.from(document.querySelectorAll('[data-analytics-id="creation_gallery.thumbnail_click"]'));
          const results: any[] = [];
          for (const card of cards) {
            const mediaId = card.getAttribute('data-analytics-media-id');
            if (!mediaId) continue;

            const img = card.querySelector('img[data-nimg="fill"]') as HTMLImageElement;
            const video = card.querySelector('video[src]') as HTMLVideoElement;

            let url: string | null = null;
            if (img && img.complete && img.naturalWidth > 0) url = img.src;
            else if (video && video.src) url = video.src;
            if (!url) continue;

            const parts = mediaId.split('-content-');
            const batchId = parts[0];
            const indexPart = parts[1];
            if (!batchId || indexPart === undefined) continue;
            results.push({ mediaId, batchId, index: Number(indexPart), url });
          }
          return results;
        }) as ReadyThumbnail[];

        // Filtrar las del nuevo batch
        const fresh = readyThumbs.filter((t) => !beforeIds.has(t.mediaId));
        const byBatch = new Map<string, ReadyThumbnail[]>();
        for (const t of fresh) {
          const arr = byBatch.get(t.batchId) ?? [];
          arr.push(t);
          byBatch.set(t.batchId, arr);
        }
        
        for (const arr of byBatch.values()) {
          if (arr.length >= 4) {
            batchMedia = arr.sort((a, b) => a.index - b.index).slice(0, 4);
            break;
          }
        }

        if (batchMedia) {
          generationSuccess = true;
          break;
        }
      }

      if (generationSuccess && batchMedia) {
        console.log('[vibes-bot] Lote de video detectado. Esperando 20s para estabilización del CDN...');
        await page.waitForTimeout(MEDIA_STABILIZE_MS);

        // Volver a leer la URL final
        const finalUrls = await page.evaluate((mediaIds: string[]) => {
          return mediaIds.map(id => {
            const card = document.querySelector(`[data-analytics-media-id="${id}"]`);
            if (!card) return null;
            const video = card.querySelector('video[src]') as HTMLVideoElement;
            return video ? video.src : null;
          });
        }, batchMedia.map(t => t.mediaId)) as (string | null)[];

        finalVideoUrl = finalUrls[0] || batchMedia[0].url;
        break;
      }

      if (attempt >= MAX_GENERATION_ATTEMPTS) {
        console.error('[vibes-bot] Todos los intentos de generación de video fallaron.');
        return { success: false, error: 'generation_limit_reached' };
      }

      console.log(`[vibes-bot] Generación fallida. Esperando cooldown de ${GENERATION_RETRY_DELAY_MS / 1000}s para reintentar...`);
      await page.waitForTimeout(GENERATION_RETRY_DELAY_MS);
      errorBaseline = await countGenerationErrors(page);
    }

    // 7. Descargar el video final en la ruta destino
    if (!finalVideoUrl) {
      return { success: false, error: 'no_video_url_resolved' };
    }

    console.log(`[vibes-bot] Descargando video final desde: ${finalVideoUrl}...`);
    const response = await fetch(finalVideoUrl);
    if (!response.ok) {
      throw new Error(`Error en descarga de video: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.promises.writeFile(outputVideoPath, buffer);
    console.log(`[vibes-bot] Video final descargado con éxito en: ${outputVideoPath}`);

    // 8. Limpieza de start frame de la interfaz
    await removeStartFrame(page);

    console.log('[vibes-bot] Obteniendo duración del video...');
    const durationSeconds = await getVideoDuration(outputVideoPath);

    return { success: true, filePath: outputVideoPath, durationSeconds };
  } catch (error: any) {
    console.error('[vibes-bot] Excepción crítica durante animación:', error);
    return { success: false, error: error.message || String(error) };
  }
}
