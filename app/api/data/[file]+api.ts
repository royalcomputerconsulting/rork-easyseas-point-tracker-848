import { Hono } from 'hono';
import path from 'path';
import fs from 'fs';

const app = new Hono();

const resolveFilePath = (file: string): string | null => {
  const possiblePaths = [
    path.join(process.cwd(), 'DATA', file),
    path.join(process.cwd(), '..', 'DATA', file),
    path.join(__dirname, '../../../DATA', file),
    path.join(__dirname, '../../../../DATA', file),
    path.join(__dirname, '../../../../../DATA', file),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
};

app.get('/', async (c) => {
  try {
    const url = new URL(c.req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const file = pathParts[pathParts.length - 1];

    console.log(`[DataAPI] Request for file: ${file}`);
    console.log(`[DataAPI] Full URL: ${c.req.url}`);
    console.log(`[DataAPI] Path parts:`, pathParts);

    const allowedFiles = [
      'cruises.xlsx',
      'booked.xlsx',
      'offers.xlsx',
      'calendar.ics',
      'tripit.ics',
      'cruises.database.json',
      'offers.database.json',
    ];
    if (!allowedFiles.includes(file)) {
      console.log(`[DataAPI] File not allowed: ${file}`);
      return c.json({ error: 'File not allowed' }, 403);
    }

    const filePath = resolveFilePath(file);

    if (!filePath) {
      console.log(`[DataAPI] ❌ File not found: ${file}`);
      return c.json({ error: 'File not found' }, 404);
    }

    const fileBuffer = fs.readFileSync(filePath);
    console.log(`[DataAPI] ✅ Read file, size: ${fileBuffer.length} bytes`);

    let contentType = 'application/octet-stream';
    if (file.endsWith('.xlsx')) {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (file.endsWith('.ics')) {
      contentType = 'text/calendar';
    } else if (file.endsWith('.json')) {
      contentType = 'application/json';
    }

    console.log(`[DataAPI] Serving ${file} with content-type: ${contentType}`);

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[DataAPI] Error serving file:', error);
    return c.json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }, 500);
  }
});

app.put('/', async (c) => {
  try {
    const url = new URL(c.req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const file = pathParts[pathParts.length - 1];

    const writable = ['cruises.database.json', 'offers.database.json'];
    if (!writable.includes(file)) {
      return c.json({ error: 'Only cruises.database.json and offers.database.json are writable' }, 403);
    }

    const filePath = resolveFilePath(file) || path.join(process.cwd(), 'DATA', file);

    const bodyText = await c.req.text();
    try {
      JSON.parse(bodyText);
    } catch (e) {
      return c.json({ error: 'Invalid JSON' }, 400);
    }

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, bodyText, 'utf-8');
    console.log(`[DataAPI] ✅ Wrote ${file} (${bodyText.length} bytes) to ${filePath}`);

    return c.json({ ok: true });
  } catch (error) {
    console.error('[DataAPI] Error writing file:', error);
    return c.json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }, 500);
  }
});

export default app;
