import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import { initializeStorage, storageConfig, getDataFilePath, saveDataFile, readDataFile } from "../lib/storage";

console.log('[Hono] ===== INITIALIZING HONO BACKEND SERVER ===== (Restart: ' + new Date().toISOString() + ')');

initializeStorage();
console.log('[Hono] Storage initialized:');
console.log('[Hono]   Environment:', storageConfig.isRender ? 'Render (persistent disk)' : 'Local development');
console.log('[Hono]   DATA directory:', storageConfig.dataDir);

// Debug app router
console.log('[Hono] App router type:', typeof appRouter);
if (appRouter && (appRouter as any)._def) {
  const procedures = (appRouter as any)._def.procedures || {};
  console.log('[Hono] Top-level routers:', Object.keys(procedures));
  
  // Check analytics specifically
  if (procedures.analytics) {
    const analyticsProcedures = (procedures.analytics as any)._def?.procedures || {};
    console.log('[Hono] Analytics procedures:', Object.keys(analyticsProcedures));
  } else {
    console.error('[Hono] No analytics router found in app router!');
  }
}

const app = new Hono();

console.log('[Hono] ✅ Hono app instance created successfully');

// Enable CORS for all routes
app.use("*", cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Accept', 'User-Agent'],
  maxAge: 86400,
}));

console.log('[Hono] CORS middleware configured');

// Health check endpoints - MUST be registered BEFORE tRPC middleware
app.get("/", (c) => {
  console.log('[Hono] Root health check endpoint hit');
  try {
    return c.json({ 
      status: "ok", 
      message: "Hono backend is running",
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        platform: process.platform,
        nodeVersion: process.version
      },
      routes: {
        root: '/',
        apiRoot: '/api',
        apiHealth: '/api/health',
        healthAlias: '/health',
        trpc: '/trpc/*',
        apiTrpc: '/api/trpc/*'
      }
    });
  } catch (error) {
    console.error('[Hono] Error in root health check:', error);
    return c.json({ 
      status: "error", 
      message: "Health check failed",
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Dedicated health aliases (GET + HEAD) to be resilient to proxy/basepath issues
app.get("/health", (c) => {
  console.log('[Hono] Health alias endpoint hit (/health)');
  try {
    return c.json({ status: "ok", message: "Hono health OK", path: "/health", timestamp: new Date().toISOString() });
  } catch (error) {
    return c.json({ status: "error", message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
app.on('HEAD', "/health", (c) => {
  return c.body(null, 200);
});

app.get("/api/health", (c) => {
  console.log('[Hono] API health alias endpoint hit (/api/health)');
  try {
    return c.json({ 
      status: "ok", 
      message: "Hono API health check successful",
      timestamp: new Date().toISOString(),
      routes: {
        health: '/api/health',
        trpc: '/api/trpc/*'
      }
    });
  } catch (error) {
    console.error('[Hono] Error in /api/health check:', error);
    return c.json({ 
      status: "error", 
      message: "API health check failed",
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});
app.on('HEAD', "/api/health", (c) => {
  return c.body(null, 200);
});

app.get("/api", (c) => {
  console.log('[Hono] API health check endpoint hit');
  try {
    return c.json({ 
      status: "ok", 
      message: "Hono API is running",
      timestamp: new Date().toISOString(),
      routes: {
        health: '/api',
        healthAlias: '/api/health',
        trpc: '/api/trpc/*'
      }
    });
  } catch (error) {
    console.error('[Hono] Error in API health check:', error);
    return c.json({ 
      status: "error", 
      message: "API health check failed",
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

console.log('[Hono] Health check endpoints registered');

// Serve local DATA files
app.get("/api/data/:filename", async (c) => {
  const filename = c.req.param('filename');
  console.log('[Hono] Serving DATA file:', filename);
  
  try {
    const fs = await import('fs');
    const path = await import('path');
    
    // Try multiple possible locations for DATA folder
    const possiblePaths = [
      path.resolve(process.cwd(), 'DATA', filename),
      path.resolve(process.cwd(), '../DATA', filename),
      path.resolve(__dirname, '../DATA', filename),
      path.resolve(__dirname, '../../DATA', filename),
      path.resolve(__dirname, '../../../DATA', filename),
    ];
    
    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        console.log('[Hono] Found file at:', filePath);
        const fileBuffer = fs.readFileSync(filePath);
        
        // Set appropriate content type
        let contentType = 'application/octet-stream';
        if (filename.endsWith('.xlsx')) {
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        } else if (filename.endsWith('.ics')) {
          contentType = 'text/calendar';
        } else if (filename.endsWith('.csv')) {
          contentType = 'text/csv';
        } else if (filename.endsWith('.json')) {
          contentType = 'application/json';
        }
        
        return c.body(fileBuffer, 200, {
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="${filename}"`,
          'Cache-Control': 'no-cache'
        });
      }
    }
    
    console.log('[Hono] File not found:', filename);
    return c.json({ error: 'File not found', filename, searchedPaths: possiblePaths }, 404);
  } catch (error) {
    console.error('[Hono] Error serving file:', error);
    return c.json({ 
      error: 'Failed to serve file', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Write to DATA files (only for specific files)
app.put("/api/data/:filename", async (c) => {
  const filename = c.req.param('filename');
  console.log('[Hono] Writing DATA file:', filename);
  
  // Only allow writing to specific files
  const writableFiles = ['cruises.database.json'];
  if (!writableFiles.includes(filename)) {
    return c.json({ error: 'File not writable', filename }, 403);
  }
  
  try {
    const fs = await import('fs');
    const path = await import('path');
    
    // Prefer process.cwd()/DATA for writing
    const dataDir = path.resolve(process.cwd(), 'DATA');
    const filePath = path.join(dataDir, filename);
    
    // Ensure DATA directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('[Hono] Created DATA directory:', dataDir);
    }
    
    const bodyText = await c.req.text();
    
    // Validate JSON if it's a JSON file
    if (filename.endsWith('.json')) {
      try {
        JSON.parse(bodyText);
      } catch (e) {
        return c.json({ error: 'Invalid JSON', message: e instanceof Error ? e.message : 'Unknown error' }, 400);
      }
    }
    
    fs.writeFileSync(filePath, bodyText, 'utf-8');
    console.log(`[Hono] ✅ Wrote ${filename} (${bodyText.length} bytes) to ${filePath}`);
    
    return c.json({ ok: true, path: filePath, size: bodyText.length });
  } catch (error) {
    console.error('[Hono] Error writing file:', error);
    return c.json({ 
      error: 'Failed to write file', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

console.log('[Hono] DATA file serving endpoint registered at /api/data/:filename (GET/PUT)');

// Path normalizer: collapse duplicate "/trpc" segments before tRPC mounts
app.use("*", async (c, next) => {
  const url = new URL(c.req.url);
  const originalPath = url.pathname;
  let normalizedPath = originalPath;

  // Replace multiple occurrences of /trpc in a row (e.g., /api/trpc/trpc/...) with a single one
  normalizedPath = normalizedPath.replace(/\/trpc(?:\/trpc)+\//g, '/trpc/');

  if (normalizedPath !== originalPath) {
    const newUrl = `${url.origin}${normalizedPath}${url.search}`;
    console.warn('[Hono] Normalizing duplicated /trpc segments:', { from: originalPath, to: normalizedPath });
    return c.redirect(newUrl, 307);
  }

  await next();
});

// Logging middleware
app.use("*", async (c, next) => {
  const start = Date.now();
  const url = new URL(c.req.url);
  console.log(`[Hono] ${c.req.method} ${url.pathname}`);
  
  try {
    await next();
    const duration = Date.now() - start;
    console.log(`[Hono] Response: ${c.res.status} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`[Hono] Error after ${duration}ms:`, {
      method: c.req.method,
      path: url.pathname,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack?.substring(0, 300) : 'No stack'
    });
    throw error;
  }
});

// Extra defensive mounts to handle accidental double "/trpc" in path (e.g. /api/trpc/trpc/..)
// IMPORTANT: Register these BEFORE the broader mounts so they take precedence
app.use(
  "/api/trpc/trpc/*",
  trpcServer({
    endpoint: "/api/trpc/trpc",
    router: appRouter,
    createContext,
    onError: ({ error, path, input }) => {
      console.error(`[Hono tRPC Defensive] Error in ${path}:`, {
        message: error.message,
        code: error.code,
        stack: error.stack?.substring(0, 500),
        input: input ? JSON.stringify(input).substring(0, 200) : 'none'
      });
    },
  })
);

app.use(
  "/trpc/trpc/*",
  trpcServer({
    endpoint: "/trpc/trpc",
    router: appRouter,
    createContext,
    onError: ({ error, path, input }) => {
      console.error(`[Hono tRPC Defensive Legacy] Error in ${path}:`, {
        message: error.message,
        code: error.code,
        stack: error.stack?.substring(0, 500),
        input: input ? JSON.stringify(input).substring(0, 200) : 'none'
      });
    },
  })
);

console.log('[Hono] Defensive mounts added for /api/trpc/trpc/* and /trpc/trpc/*');

// Mount tRPC router at /api/trpc/* (primary endpoint)
app.use(
  "/api/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
    responseMeta: () => {
      return {
        headers: {
          'Content-Type': 'application/json',
        },
      };
    },
    onError: ({ error, path, input }) => {
      console.error(`[Hono tRPC] Error in ${path}:`, {
        message: error.message,
        code: error.code,
        stack: error.stack?.substring(0, 500),
        input: input ? JSON.stringify(input).substring(0, 200) : 'none'
      });
    },
  })
);

console.log('[Hono] tRPC router mounted at /api/trpc/*');

// Also mount at /trpc/* for backward compatibility
app.use(
  "/trpc/*",
  trpcServer({
    endpoint: "/trpc",
    router: appRouter,
    createContext,
    onError: ({ error, path, input }) => {
      console.error(`[Hono tRPC Legacy] Error in ${path}:`, {
        message: error.message,
        code: error.code,
        stack: error.stack?.substring(0, 500),
        input: input ? JSON.stringify(input).substring(0, 200) : 'none'
      });
    },
  })
);

console.log('[Hono] tRPC router also mounted at /trpc/* for backward compatibility');

// Catch-all for debugging
app.all("*", (c) => {
  const url = new URL(c.req.url);
  console.log(`[Hono] Unmatched route: ${c.req.method} ${url.pathname}`);
  console.log(`[Hono] Request headers:`, {
    'content-type': c.req.header('content-type'),
    'user-agent': c.req.header('user-agent')?.substring(0, 50),
    'accept': c.req.header('accept')
  });
  
  return c.json({ 
    error: "Route not found in Hono backend", 
    method: c.req.method,
    path: url.pathname,
    timestamp: new Date().toISOString(),
    availableRoutes: [
      'GET / - Root health check',
      'GET /health - Health alias',
      'HEAD /health - Health alias (HEAD)',
      'GET /api - API health check',
      'GET /api/health - API health alias',
      'HEAD /api/health - API health alias (HEAD)',
      'GET /api/data/:filename - Serve DATA files',
      'PUT /api/data/:filename - Write DATA files (limited)',
      'POST /trpc/* - tRPC procedures',
      'GET /trpc/* - tRPC procedures',
      'POST /api/trpc/* - tRPC procedures (API prefix)',
      'GET /api/trpc/* - tRPC procedures (API prefix)'
    ],
    suggestion: "This request reached Hono but didn't match any routes. Check if the tRPC endpoint path is correct.",
    note: "If you're seeing this, the API routing is working but the specific endpoint wasn't found."
  }, 404);
});

console.log('[Hono] Backend server configuration complete');

// Auto-trigger startup import on server start
(async () => {
  try {
    console.log('[Hono] Auto-triggering startup data import...');
    const { preloadFromDataFolder } = await import('./trpc/routes/import/startup');
    const result = await preloadFromDataFolder();
    console.log('[Hono] Startup import result:', {
      success: result.ok,
      message: result.message,
      imported: result.imported,
      filesFound: result.filesFound
    });
  } catch (error) {
    console.warn('[Hono] Startup import failed (this is normal if no DATA folder exists):', error instanceof Error ? error.message : 'Unknown error');
  }
})();

export default app;