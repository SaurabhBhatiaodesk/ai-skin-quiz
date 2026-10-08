// Enforce the actual streamed body size, even when Content-Length is absent.
export async function readBoundedJson(request: Request, maxBytes = 7500000) {
  if (Number(request.headers.get("content-length") || 0) > maxBytes) throw new Error("Photo too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Invalid request.");
  const decoder = new TextDecoder(); let bytes = 0, text = "";
  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      const value = chunk.value;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new Error("Photo too large."); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } finally { reader.releaseLock(); }
}
