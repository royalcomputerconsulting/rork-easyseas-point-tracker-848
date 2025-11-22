import { publicProcedure } from '../../../create-context';
import { z } from 'zod';

type StepResult = {
  name: string;
  ok: boolean;
  statusCode?: number;
  url?: string;
  durationMs: number;
  error?: string;
};

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return new Promise<T>((resolve, reject) => {
    p.then((v) => {
      clearTimeout(id);
      resolve(v);
    }).catch((e) => {
      clearTimeout(id);
      reject(e);
    });
  });
}

async function tryFetch(url: string, init?: RequestInit, timeoutMs = 12000): Promise<{ ok: boolean; status: number; error?: string; durationMs: number }>
{
  const started = Date.now();
  try {
    const res = await withTimeout(fetch(url, {
      method: init?.method ?? 'GET',
      headers: {
        'User-Agent': 'CruiseApp-Diagnostic/1.0',
        'Accept': 'text/html,application/json;q=0.9,*/*;q=0.8',
        ...(init?.headers ?? {})
      },
      redirect: 'follow',
      ...init,
    }), timeoutMs);
    return { ok: res.ok, status: res.status, durationMs: Date.now() - started };
  } catch (e: any) {
    return { ok: false, status: -1, error: e?.message ?? 'fetch failed', durationMs: Date.now() - started };
  }
}

export const gangwazeDiagnosticProcedure = publicProcedure
  .input(z.object({
    simulateLogin: z.boolean().default(true),
  }))
  .mutation(async ({ input }) => {
    const steps: StepResult[] = [];

    // Step 1: Reachability
    {
      const url = 'https://www.gangwaze.com/';
      const r = await tryFetch(url);
      steps.push({ name: 'Reach gangwaze.com', ok: r.ok, statusCode: r.status, url, durationMs: r.durationMs, error: r.error });
    }

    // Step 2: Get a cruise search page (unauthenticated content)
    {
      const url = 'https://www.gangwaze.com/cruise-lines/royal-caribbean/';
      const r = await tryFetch(url);
      steps.push({ name: 'Open Royal Caribbean index', ok: r.ok, statusCode: r.status, url, durationMs: r.durationMs, error: r.error });
    }

    // Step 3: Simulated login (without credentials we just probe login form)
    if (input.simulateLogin) {
      const url = 'https://www.gangwaze.com/login';
      const r = await tryFetch(url);
      steps.push({ name: 'Load login page (simulate login start)', ok: r.ok, statusCode: r.status, url, durationMs: r.durationMs, error: r.error });
    }

    // Step 4: Download test content (e.g., sitemap or a static asset)
    {
      const url = 'https://www.gangwaze.com/sitemap.xml';
      const r = await tryFetch(url, { headers: { Accept: 'application/xml' } });
      steps.push({ name: 'Download sitemap.xml', ok: r.ok, statusCode: r.status, url, durationMs: r.durationMs, error: r.error });
    }

    // Step 5: Simulated logout (probe any account page which should redirect)
    {
      const url = 'https://www.gangwaze.com/account';
      const r = await tryFetch(url, { redirect: 'follow' });
      steps.push({ name: 'Logout/redirect check (no session)', ok: r.ok, statusCode: r.status, url, durationMs: r.durationMs, error: r.error });
    }

    const successCount = steps.filter(s => s.ok).length;
    const failureCount = steps.length - successCount;

    return {
      success: failureCount === 0,
      successCount,
      failureCount,
      totalSteps: steps.length,
      steps,
      finishedAt: new Date().toISOString(),
    };
  });
