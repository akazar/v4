/**
 * Shared server-side image format normalizer.
 * Accepts raw base64 or data URL; returns { mimeType, base64Data, dataUrl }.
 * Used by recognition-server and reasoning-server for a unified request format.
 */

/**
 * Normalize image input from request body (raw base64 or data URL).
 * @param {string} imageBase64 - Raw base64 string or full data URL (e.g. data:image/jpeg;base64,...)
 * @returns {{ mimeType: string, base64Data: string, dataUrl: string }}
 */
export function normalizeBase64Image(imageBase64) {
  if (typeof imageBase64 !== "string" || imageBase64.trim().length === 0) {
    throw new Error("imageBase64 must be a non-empty string");
  }

  const trimmed = imageBase64.trim();

  const match = trimmed.match(/^data:([^;]+);base64,(.*)$/i);
  if (match) {
    const mimeType = match[1] || "image/jpeg";
    const base64Data = match[2] || "";
    if (!base64Data) throw new Error("Invalid data URL (missing base64 payload)");
    return {
      mimeType,
      base64Data,
      dataUrl: `data:${mimeType};base64,${base64Data}`,
    };
  }

  const mimeType = "image/jpeg";
  return {
    mimeType,
    base64Data: trimmed,
    dataUrl: `data:${mimeType};base64,${trimmed}`,
  };
}
