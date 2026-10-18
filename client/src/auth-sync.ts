const key = "strive:account-event";
type AuthEvent = "signed-out" | "account-changed";
export function publishAuthEvent(type: AuthEvent) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ type, nonce: crypto.randomUUID() }),
    );
  } catch {
    /* Cookie sessions still work when browser storage is unavailable. */
  }
}
export function subscribeAuthEvents(listener: (type: AuthEvent) => void) {
  const handle = (event: StorageEvent) => {
    if (event.key !== key || !event.newValue || event.newValue.length > 200)
      return;
    try {
      const data = JSON.parse(event.newValue);
      if (data.type === "signed-out" || data.type === "account-changed")
        listener(data.type);
    } catch {
      /* Ignore unrelated or malformed storage messages. */
    }
  };
  window.addEventListener("storage", handle);
  return () => window.removeEventListener("storage", handle);
}
