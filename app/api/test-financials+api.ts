export async function GET(request: Request) {
  console.log('[Test API] GET /api/test-financials called');
  
  try {
    // Import the memory store directly
    const { memoryStore } = await import('@/backend/trpc/routes/_stores/memory');
    
    const financials = memoryStore.getFinancials();
    const receipts = memoryStore.getReceipts();
    const statements = memoryStore.getCruiseStatements();
    
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      counts: {
        financials: financials.length,
        receipts: receipts.length,
        statements: statements.length,
      },
      message: 'Direct API test successful',
    };
    
    console.log('[Test API] Returning response:', response);
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[Test API] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

export async function POST(request: Request) {
  console.log('[Test API] POST /api/test-financials called');
  
  try {
    const body = await request.json();
    console.log('[Test API] Request body:', body);
    
    const { memoryStore } = await import('@/backend/trpc/routes/_stores/memory');
    
    if (body.action === 'insertTestReceipt') {
      const testRecord = {
        cruiseId: 'test-cruise-001',
        shipName: 'Test Ship',
        sourceType: 'receipt' as const,
        receiptDateTime: new Date().toISOString(),
        venue: 'Test Venue',
        category: 'Food & Beverage' as const,
        itemDescription: 'Test Item',
        lineTotal: 100,
        paymentMethod: 'SeaPass' as const,
        processedAt: new Date().toISOString(),
        verified: false,
      };
      
      const result = memoryStore.addFinancials([testRecord]);
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Test receipt added',
          inserted: result.length,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'POST endpoint working',
        receivedAction: body.action,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('[Test API] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}