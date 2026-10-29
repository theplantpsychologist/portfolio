// Sends a Google Analytics event when GA is enabled (PUBLIC_GA_ID); otherwise does nothing.
// Event names and parameters show up under Reports → Engagement → Events.
type Params = Record<string, string | number | boolean | undefined>;

export function track(name: string, params: Params = {}) {
  (window as { gtag?: (...args: unknown[]) => void }).gtag?.("event", name, params);
}

/** Like track(), but waits until calls stop for `ms` (for typing and filter clicks). */
export function trackLater(ms = 1500) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (name: string, params: Params = {}) => {
    clearTimeout(timer);
    timer = setTimeout(() => track(name, params), ms);
  };
}
