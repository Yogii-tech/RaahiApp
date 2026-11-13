export async function parseJsonSafe<T = any>(
    response: Response | null | undefined
): Promise<T | null> {
    if (!response) return null;
    if (response.status === 204 || response.status === 205 || response.status === 304) {
        return null;
    }
    try {
        if (typeof response.text === 'function') {
            const raw = await response.text();
            if (!raw || !raw.trim()) return null;
            return JSON.parse(raw) as T;
        }
        if (typeof response.json === 'function') {
            return (await response.json()) as T;
        }
        return null;
    } catch {
        return null;
    }
}

export function getApiErrorMessage(
    data: any,
    fallback: string,
    response?: Response | null
): string {
    if (data && typeof data === 'object') {
        const msg = data.error || data.message || data.detail;
        if (typeof msg === 'string' && msg.trim()) {
            return msg.trim();
        }
    }
    if (response && response.status === 503) {
        return 'Service temporarily unavailable. Please try again.';
    }
    if (response && response.status >= 500) {
        return `${fallback} (Server error ${response.status})`;
    }
    return fallback;
}

export interface RequestAbortHandle {
    controller: AbortController;
    signal: AbortSignal;
    didTimeout: () => boolean;
    cleanup: () => void;
}

export function createRequestAbort(
    timeoutMs: number,
    externalSignal?: AbortSignal | null
): RequestAbortHandle {
    const controller = new AbortController();
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const onExternalAbort = () => {
        if (!controller.signal.aborted) {
            controller.abort();
        }
    };

    if (externalSignal) {
        if (externalSignal.aborted) {
            onExternalAbort();
        } else if (typeof externalSignal.addEventListener === 'function') {
            externalSignal.addEventListener('abort', onExternalAbort, { once: true });
        }
    }

    if (timeoutMs > 0 && !controller.signal.aborted) {
        timer = setTimeout(() => {
            timedOut = true;
            if (!controller.signal.aborted) {
                controller.abort();
            }
        }, timeoutMs);
    }

    const cleanup = () => {
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
        if (externalSignal && typeof externalSignal.removeEventListener === 'function') {
            externalSignal.removeEventListener('abort', onExternalAbort);
        }
    };

    return {
        controller,
        signal: controller.signal,
        didTimeout: () => timedOut,
        cleanup,
    };
}
