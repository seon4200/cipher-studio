import fs from 'fs';

/**
 * Genera una imagen utilizando la API de Google Gemini (modelo gemini-2.5-flash-image)
 * y la guarda directamente en la ruta especificada en formato PNG/JPEG.
 *
 * @param prompt Prompt descriptivo de la imagen
 * @param outputPath Ruta absoluta en disco donde se guardará la imagen
 * @param aspectRatio Relación de aspecto (ej. '9:16')
 */
export async function generateImage(
  prompt: string,
  outputPath: string,
  aspectRatio?: string
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const errMsg = '[nanoBananaProvider] Error: GEMINI_API_KEY no está configurada en las variables de entorno.';
    console.error(errMsg);
    return { success: false, error: 'GEMINI_API_KEY missing' };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: aspectRatio || "9:16"
      }
    }
  };

  try {
    console.log(`[nanoBananaProvider] Generando imagen para prompt: "${prompt}" (Aspect Ratio: ${aspectRatio || '9:16'})...`);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 429) {
      const errMsg = '[nanoBananaProvider] Límite de tasa (Rate Limit 429) alcanzado en la API de Gemini.';
      console.warn(errMsg);
      return { success: false, error: 'rate_limit_exceeded' };
    }

    if (!response.ok) {
      const errText = await response.text();
      const errMsg = `[nanoBananaProvider] Error en la petición API: ${response.status} - ${response.statusText}. Detalle: ${errText}`;
      console.error(errMsg);
      return { success: false, error: `api_error_${response.status}` };
    }

    const data = (await response.json()) as any;
    const part = data?.candidates?.[0]?.content?.parts?.[0];
    const base64Data = part?.inlineData?.data;

    if (!base64Data) {
      const errMsg = '[nanoBananaProvider] La respuesta de la API no contiene datos de imagen válidos.';
      console.error(errMsg, JSON.stringify(data));
      return { success: false, error: 'invalid_api_response' };
    }

    const buffer = Buffer.from(base64Data, 'base64');
    await fs.promises.writeFile(outputPath, buffer);

    console.log(`[nanoBananaProvider] Imagen generada con éxito y guardada en: ${outputPath}`);
    return { success: true, filePath: outputPath };
  } catch (error: any) {
    const errMsg = `[nanoBananaProvider] Excepción al llamar a la API de Gemini: ${error.message || error}`;
    console.error(errMsg);
    return { success: false, error: 'exception_thrown' };
  }
}
