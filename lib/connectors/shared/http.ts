type FetchBodyType = "text" | "buffer";

function createTimedSignal(timeoutMs: number, externalSignal?: AbortSignal) {
  const controller = new AbortController();
  const timeoutReason = new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s.`);
  const timeoutId = setTimeout(() => controller.abort(timeoutReason), timeoutMs);

  const abortFromExternal = () => controller.abort(externalSignal?.reason ?? new Error("Request aborted."));

  if (externalSignal) {
    if (externalSignal.aborted) {
      abortFromExternal();
    } else {
      externalSignal.addEventListener("abort", abortFromExternal, { once: true });
    }
  }

  function cleanup() {
    clearTimeout(timeoutId);

    if (externalSignal) {
      externalSignal.removeEventListener("abort", abortFromExternal);
    }
  }

  return {
    signal: controller.signal,
    cleanup
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  options: {
    timeoutMs?: number;
    signal?: AbortSignal;
    bodyType?: FetchBodyType;
  } = {}
) {
  const timeoutMs = options.timeoutMs ?? 15000;
  const timedSignal = createTimedSignal(timeoutMs, options.signal);

  try {
    const response = await fetch(url, {
      ...init,
      signal: timedSignal.signal
    });

    if (!response.ok) {
      throw new Error(`Failed request ${response.status} for ${url}`);
    }

    if (options.bodyType === "buffer") {
      return Buffer.from(await response.arrayBuffer());
    }

    return response.text();
  } finally {
    timedSignal.cleanup();
  }
}

export async function fetchTextWithTimeout(
  url: string,
  init: RequestInit,
  options?: {
    timeoutMs?: number;
    signal?: AbortSignal;
  }
) {
  return fetchWithTimeout(url, init, {
    ...options,
    bodyType: "text"
  }) as Promise<string>;
}

export async function fetchBufferWithTimeout(
  url: string,
  init: RequestInit,
  options?: {
    timeoutMs?: number;
    signal?: AbortSignal;
  }
) {
  return fetchWithTimeout(url, init, {
    ...options,
    bodyType: "buffer"
  }) as Promise<Buffer>;
}
