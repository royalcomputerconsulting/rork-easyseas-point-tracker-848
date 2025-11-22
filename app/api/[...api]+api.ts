import app from '@/backend/hono';

const handler = async (request: Request) => {
  console.log('[Hono API] Handling request:', {
    method: request.method,
    url: request.url,
    pathname: new URL(request.url).pathname
  });
  
  try {
    const response = await app.fetch(request);
    console.log('[Hono API] Response status:', response.status);
    return response;
  } catch (error) {
    console.error('[Hono API] Handler error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }), 
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
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

export async function PUT(request: Request) {
  return handler(request);
}

export async function DELETE(request: Request) {
  return handler(request);
}

export async function PATCH(request: Request) {
  return handler(request);
}

export async function HEAD(request: Request) {
  return handler(request);
}

export async function OPTIONS(request: Request) {
  return handler(request);
}