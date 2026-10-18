export function upload(path: string, file: File, mime: string, token: string, signal: AbortSignal, progress: (n: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const base = import.meta.env.VITE_API_BASE_URL as string | undefined
    if (!base) { reject(new Error('The workspace API is not configured.')); return }
    // Upload paths come from this API but must still remain under its origin.
    if (!/^\/v1\/uploads\/[a-f0-9-]+\/complete$/.test(path)) { reject(new Error('Invalid upload destination.')); return }
    const request = new XMLHttpRequest()
    const abort = () => request.abort()
    signal.addEventListener('abort', abort, { once: true })
    const cleanup = () => signal.removeEventListener('abort', abort)
    request.open('PUT', `${base.replace(/\/$/, '')}${path}`)
    request.timeout = 120_000
    request.setRequestHeader('Authorization', `Bearer ${token}`)
    request.setRequestHeader('Content-Type', mime)
    request.upload.onprogress = event => { if (event.lengthComputable) progress(Math.round(event.loaded / event.total * 100)) }
    request.onload = () => {
      cleanup()
      if (request.status >= 200 && request.status < 300) resolve()
      else {
        let message = 'Upload could not be saved. Check the file and try again.'
        try { message = (JSON.parse(request.responseText) as { message?: string }).message || message } catch { /* generic safe error */ }
        reject(new Error(message))
      }
    }
    request.onerror = request.ontimeout = () => { cleanup(); reject(new Error('Upload interrupted. Keep this file selected and retry.')) }
    request.onabort = () => { cleanup(); reject(new DOMException('Upload cancelled', 'AbortError')) }
    if (signal.aborted) { cleanup(); reject(new DOMException('Upload cancelled', 'AbortError')); return }
    request.send(file)
  })
}
