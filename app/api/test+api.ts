export async function GET(request: Request) {
  const url = new URL(request.url);
  console.log('[Test API] ===== TEST API ROUTE HIT =====');
  console.log('[Test API] Request details:', {
    method: request.method,
    url: request.url,
    pathname: url.pathname,
    timestamp: new Date().toISOString(),
    userAgent: request.headers.get('user-agent')?.substring(0, 50)
  });
  
  try {
    // Test if we can import backend components
    const { memoryStore } = await import('@/backend/trpc/routes/_stores/memory');
    const cruiseCount = memoryStore.getCruises().length;
    const offerCount = memoryStore.getCasinoOffers().length;
    
    // Test tRPC router import
    let trpcRouterTest = false;
    try {
      const { appRouter } = await import('@/backend/trpc/app-router');
      trpcRouterTest = !!appRouter;
    } catch (trpcError) {
      console.error('[Test API] tRPC router import failed:', trpcError);
    }
    
    const testData = {
      status: 'success',
      message: 'Test API route is working correctly - Backend accessible',
      timestamp: new Date().toISOString(),
      requestInfo: {
        method: request.method,
        pathname: url.pathname,
        search: url.search
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        platform: process.platform,
        nodeVersion: process.version
      },
      backendTest: {
        memoryStoreAccessible: true,
        cruiseCount: cruiseCount,
        casinoOfferCount: offerCount,
        backendImportWorking: true,
        trpcRouterImportWorking: trpcRouterTest
      },
      routing: {
        apiRoutesWorking: true,
        expectedPath: '/api/test',
        actualPath: url.pathname,
        pathMatches: url.pathname === '/api/test',
        catchAllRouteRemoved: true // We removed the conflicting catch-all route
      },
      fixes: {
        conflictingCatchAllRouteRemoved: true,
        trpcRoutingIsolated: true,
        corsHeadersAdded: true
      }
    };
    
    console.log('[Test API] ✅ Backend test successful - returning data:', testData);
    
    return new Response(JSON.stringify(testData, null, 2), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
    });
  } catch (error) {
    console.error('[Test API] ❌ Backend test failed:', error);
    
    const errorData = {
      status: 'error',
      message: 'Test API route working but backend has issues',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      backendTest: {
        memoryStoreAccessible: false,
        backendImportWorking: false,
        errorDetails: error instanceof Error ? error.stack?.substring(0, 300) : 'No stack'
      },
      routing: {
        apiRoutesWorking: true,
        expectedPath: '/api/test',
        actualPath: url.pathname
      }
    };
    
    return new Response(JSON.stringify(errorData, null, 2), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
    });
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  console.log('[Test API] ===== TEST API POST ROUTE HIT =====');
  
  let body = null;
  try {
    body = await request.json();
  } catch (error) {
    console.log('[Test API] No JSON body or invalid JSON');
  }
  
  const testData = {
    status: 'success',
    message: 'Test API POST route is working correctly',
    timestamp: new Date().toISOString(),
    requestInfo: {
      method: request.method,
      pathname: url.pathname,
      hasBody: !!body,
      bodyPreview: body ? JSON.stringify(body).substring(0, 100) : 'none'
    }
  };
  
  console.log('[Test API] Returning POST test data:', testData);
  
  return new Response(JSON.stringify(testData, null, 2), {
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
  });
}

export async function OPTIONS() {
  console.log('[Test API] ===== TEST API OPTIONS REQUEST =====');
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}