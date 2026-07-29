/**
 * `fetch()` has no default timeout. A server that accepts the connection and
 * then stalls leaves the promise pending indefinitely, and with it whatever
 * spinner the caller is showing: the user's only recourse is reloading the page.
 * Every first-party API call goes through this wrapper so a hung request
 * surfaces as an ordinary error the UI can render.
 */

/** Enough for a normal round trip to a serverless function, including a cold start. */
export const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * Diagram generation waits on an upstream model. The server bounds that at 30s
 * and the platform kills the function at 60s (`maxDuration` in vercel.json), so
 * this sits just past both: the server's own error message wins whenever there
 * is one, and this only fires if the connection itself has died.
 */
export const GENERATE_TIMEOUT_MS = 65_000;

export class RequestTimeoutError extends Error {
    constructor(message = 'The server took too long to respond. Please try again.') {
        super(message);
        this.name = 'RequestTimeoutError';
    }
}

export async function fetchWithTimeout(
    input: RequestInfo | URL,
    init: RequestInit = {},
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
    const controller = new AbortController();
    // Which one actually stopped the request. Reading `aborted` off the two
    // signals afterwards cannot tell us: a caller who cancels just after the
    // deadline fires leaves both set, and the request would be reported as
    // their cancellation when it was really a timeout. First one wins.
    let cause: 'timeout' | 'caller' | null = null;

    const timer = setTimeout(() => {
        cause ??= 'timeout';
        controller.abort();
    }, timeoutMs);

    // Passing `signal: controller.signal` overwrites whatever the caller put in
    // `init`, so their own cancellation would quietly stop working. Chain the
    // two instead: either one aborts the request, and the caller's reason is
    // carried through so they can tell why.
    const external = init.signal ?? undefined;
    const forwardAbort = () => {
        cause ??= 'caller';
        controller.abort(external!.reason);
    };
    if (external) {
        if (external.aborted) forwardAbort();
        else external.addEventListener('abort', forwardAbort, { once: true });
    }

    try {
        return await fetch(input, { ...init, signal: controller.signal });
    } catch (err) {
        // Our own deadline becomes a message the UI can render. A caller's
        // abort is theirs to describe, so it propagates untouched.
        if (cause === 'timeout') throw new RequestTimeoutError();
        throw err;
    } finally {
        clearTimeout(timer);
        external?.removeEventListener('abort', forwardAbort);
    }
}
