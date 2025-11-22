export async function GET() {
  try {
    const body = {
      status: "ok",
      message: "API health check successful",
      timestamp: new Date().toISOString(),
      routes: {
        self: "/api/health",
        apiRoot: "/api",
        trpc: "/api/trpc/*",
      },
    } as const;

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
