import app from '@/backend/hono';

const handler = async (request: Request) => {
  console.log('[tRPC API Route] Handling tRPC request:', {
    method: request.method,
    url: request.url,
    pathname: new URL(request.url).pathname
  });
  
  try {
    // Forward the request to the Hono backend
    const response = await app.fetch(request);
    console.log('[tRPC API Route] Response status:', response.status);
    return response;
  } catch (error) {
    console.error('[tRPC API Route] Handler error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }), 
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        } 
      }
    );
  }
};

export async function GET(request: Request) {
  return handler(request);
}

export async function POST(request: Request) {
  return handler(request);
}

export async function OPTIONS(request: Request) {
  console.log('[tRPC API Route] Handling OPTIONS request for CORS');
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control, Pragma, Accept, User-Agent',
      'Access-Control-Max-Age': '86400',
    },
  });
}