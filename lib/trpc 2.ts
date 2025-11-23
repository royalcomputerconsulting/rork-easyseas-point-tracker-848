import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";
import { Platform } from "react-native";
import Constants from "expo-constants";

export const trpc = createTRPCReact<AppRouter>();

export const getBaseUrl = (): string => {
  console.log('[tRPC] ===== DETECTING BASE URL =====');
  console.log('[tRPC] Platform:', Platform.OS);
  
  const envBaseUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  if (envBaseUrl) {
    console.log('[tRPC] ✅ Using environment base URL:', envBaseUrl);
    return envBaseUrl.replace(/\/$/, '');
  }

  // On web, default to same-origin so /api routes work without additional config
  // Type assertion needed because Platform.OS type doesn't include 'web' in React Native
  const platformOS = Platform.OS as string;
  if (platformOS === 'web') {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      const href = window.location.href;
      console.log('[tRPC] Web environment detected:', {
        origin,
        href: href.substring(0, 100),
        hostname: window.location.hostname,
        port: window.location.port,
        protocol: window.location.protocol
      });
      
      if (origin) {
        console.log('[tRPC] ✅ Using same-origin base URL on web:', origin);
        return origin.replace(/\/$/, '');
      }
    }
    console.warn('[tRPC] ⚠️ Web platform but no window.location.origin, using offline mode');
    return 'offline://local';
  }

  // Native: Use Metro dev server URL from Expo Constants
  // This allows API routes to work in development
  const platformOS2 = Platform.OS as string;
  if (platformOS2 !== 'web') {
    console.log('[tRPC] Attempting to detect Metro dev server URL...');
    console.log('[tRPC] Constants.expoConfig:', JSON.stringify(Constants.expoConfig, null, 2).substring(0, 500));
    console.log('[tRPC] Constants.manifest2:', JSON.stringify(Constants.manifest2, null, 2).substring(0, 500));
    
    // Try to get the dev server URL from various sources
    const debuggerHost = 
      (Constants.expoConfig as any)?.hostUri || 
      (Constants.manifest2 as any)?.extra?.expoGo?.debuggerHost ||
      (Constants as any).manifest?.debuggerHost;
    
    console.log('[tRPC] Detected debuggerHost:', debuggerHost);
    
    if (debuggerHost) {
      const host = debuggerHost.split(':')[0];
      const protocol = 'http';
      const port = debuggerHost.split(':')[1] || '8081';
      const baseUrl = `${protocol}://${host}:${port}`;
      console.log('[tRPC] ✅ Using Metro dev server URL on native:', baseUrl);
      console.log('[tRPC] Debugger host:', debuggerHost);
      return baseUrl;
    }
    
    console.warn('[tRPC] ⚠️ Could not detect Metro dev server URL from Constants');
    console.warn('[tRPC] Available Constants keys:', Object.keys(Constants));
  }

  console.warn('[tRPC] ⚠️ Running in offline mode - all data stored locally');
  console.warn('[tRPC] To enable backend, set EXPO_PUBLIC_RORK_API_BASE_URL environment variable');
  return 'offline://local';
};

const baseUrl = getBaseUrl();
const isOffline = baseUrl.startsWith('offline://');
export const isBackendEnabled = !isOffline;
export const backendStatus = { baseUrl, isBackendEnabled } as const;
const normalizedBase = baseUrl.replace(/\/$/, '');
let trpcUrl: string;
if (isOffline) {
  trpcUrl = 'offline://disabled';
} else if (/\/(?:api\/)?trpc\/?$/.test(normalizedBase)) {
  trpcUrl = normalizedBase.replace(/\/$/, '');
} else if (/\/api\/?$/.test(normalizedBase)) {
  trpcUrl = `${normalizedBase.replace(/\/$/, '')}/trpc`;
} else {
  trpcUrl = `${normalizedBase}/api/trpc`;
}
if (!isOffline) {
  console.log('[tRPC] Initializing tRPC client:', {
    baseUrl: normalizedBase,
    trpcUrl,
    isWeb: (Platform.OS as string) === 'web',
    userAgent: typeof navigator !== 'undefined' ? (navigator as any).userAgent : 'N/A'
  });
  
  // Test backend connectivity
  (async () => {
    try {
      const healthUrl = `${normalizedBase}/api/health`;
      console.log('[tRPC] Testing backend connectivity to:', healthUrl);
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        console.log('[tRPC] ✅ Backend is reachable:', data);
      } else {
        const text = await response.text();
        console.warn('[tRPC] ⚠️ Backend returned non-JSON response:', {
          status: response.status,
          contentType,
          textPreview: text.substring(0, 200)
        });
        console.warn('[tRPC] App will run in offline mode');
      }
    } catch (error) {
      console.warn('[tRPC] ⚠️ Backend connectivity test failed:', error instanceof Error ? error.message : 'Unknown');
      console.warn('[tRPC] App will run in offline mode');
    }
  })();
} else {
  console.log('[tRPC] Running in offline mode - backend disabled');
}

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: trpcUrl,
      transformer: superjson,
      fetch: async (url, options) => {
        if (isOffline) {
          return new Response(JSON.stringify({ result: { data: null } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const controller = new AbortController();

        let timeoutMs = 30000;
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('confirmOfferFlyer') || urlString.includes('bulkCreate') || urlString.includes('import')) {
          timeoutMs = 300000;
        }

        const timeoutId = setTimeout(() => {
          console.warn(`[tRPC] Request timeout after ${timeoutMs}ms for URL: ${url}`);
          controller.abort();
        }, timeoutMs);

        if (!isOffline) {
          console.log(`[tRPC] Making request to: ${url}`);
          console.log(`[tRPC] Request options:`, {
            method: options?.method || 'GET',
            headers: options?.headers,
            hasBody: !!options?.body,
            bodyPreview: options?.body ? String(options.body).substring(0, 100) : 'none'
          });
        }

        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            // Ensures correct CORS on web and consistent headers
            mode: (Platform.OS as string) === 'web' ? 'cors' : undefined,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              
              ...options?.headers,
            },
          });
          
          const contentType = response.headers.get('content-type') ?? '';
          console.log(`[tRPC] Response received:`, {
            status: response.status,
            statusText: response.statusText,
            contentType,
            url: typeof url === 'string' ? url : url.toString()
          });
          
          // Check if response is empty or not JSON
          if (!contentType.includes('application/json') && !contentType.includes('application/superjson')) {
            const textPreview = await response.clone().text();
            console.error('[tRPC] Non-JSON response received:', {
              contentType,
              textPreview: textPreview.substring(0, 200),
              status: response.status
            });
            
            // If it's a successful response but not JSON, something is wrong with the server
            if (response.ok) {
              throw new Error(`Server returned non-JSON response: ${textPreview.substring(0, 100)}`);
            }
          }
          
          if (contentType.includes('text/html') || contentType.includes('text/plain')) {
            const html = await response.clone().text();
            console.error('[tRPC] HTML received instead of JSON', html.substring(0, 300));
            console.error('[tRPC] Switching to offline mode due to HTML response');
            
            return new Response(JSON.stringify({ result: { data: null } }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          if (!response.ok) {
            console.error(`[tRPC] HTTP Error ${response.status}: ${response.statusText}`);
            
            let responseText = '';
            try {
              responseText = await response.clone().text();
              console.error(`[tRPC] Error response body:`, responseText.substring(0, 500));
            } catch (textError) {
              console.error(`[tRPC] Could not read error response text:`, textError);
            }
            
            if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
              console.error('[tRPC] ===== HTML RESPONSE DETECTED =====');
              console.error('[tRPC] HTML Response Details:', {
                url: typeof url === 'string' ? url : url.toString(),
                status: response.status,
                statusText: response.statusText,
                contentType: response.headers.get('content-type'),
                responsePreview: responseText.substring(0, 300),
                responseHeaders: Object.fromEntries(response.headers.entries()),
                timestamp: new Date().toISOString()
              });
              
              console.warn('[tRPC] Backend returned HTML - switching to offline mode');
              return new Response(JSON.stringify({ result: { data: null } }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              });
            }
            
            console.warn(`[tRPC] HTTP error ${response.status} - switching to offline mode`);
            return new Response(JSON.stringify({ result: { data: null } }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          return response;
        } catch (error: any) {
          try {
            const details = {
              url: typeof url === 'string' ? url : url.toString(),
              name: error?.name ?? 'UnknownError',
              message: typeof error?.message === 'string' ? error.message : JSON.stringify(error?.message ?? ''),
              code: error?.code ?? 'UNKNOWN',
            } as const;
            console.error(`[tRPC] Request failed: ${details.name} - ${details.message}`, details);
            console.error('[tRPC] Connection details:', {
              baseUrl: normalizedBase,
              trpcUrl,
              isWeb: (Platform.OS as string) === 'web',
              origin: typeof window !== 'undefined' ? window.location.origin : 'N/A'
            });
          } catch (_logErr) {
            console.error('[tRPC] Request failed: Unknown error (could not serialize error)');
          }
          
          if (error?.message?.includes('🔧')) {
            console.log('[tRPC] Re-throwing formatted error');
            throw error;
          }
          
          if (error?.name === 'AbortError') {
            console.error(`[tRPC] Request aborted due to timeout (${timeoutMs}ms)`);
            throw new Error(`⏱️ Request Timeout after ${timeoutMs / 1000}s`);
          }
          
          if (error?.message?.includes('Failed to fetch') || error?.name === 'TypeError') {
            console.error('[tRPC] ===== BACKEND CONNECTION FAILED =====');
            console.error('[tRPC] This usually means:');
            console.error('[tRPC] 1. The backend server is not running');
            console.error('[tRPC] 2. The backend URL is incorrect');
            console.error('[tRPC] 3. CORS is blocking the request');
            console.error('[tRPC] 4. Network connectivity issues');
            console.error('[tRPC] Current configuration:', {
              attemptedUrl: typeof url === 'string' ? url : url.toString(),
              baseUrl: normalizedBase,
              trpcUrl,
              platform: Platform.OS,
              isOffline
            });
            console.error('[tRPC] ===== END CONNECTION ERROR =====');
            
            // Return empty response instead of throwing to allow app to work offline
            return new Response(JSON.stringify({ result: { data: null } }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          throw new Error(`🔧 Unexpected Error: ${error?.message || 'Unknown error'}`);
        } finally {
          clearTimeout(timeoutId);
        }
      },
    }),
  ],
});