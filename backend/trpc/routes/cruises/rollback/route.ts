import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { memoryStore } from '../../_stores/memory';

// Rollback Management Procedures

// Get available snapshots for rollback
export const getSnapshotsProcedure = publicProcedure
  .query(async () => {
    console.log('[tRPC] cruises.getSnapshots called');
    
    const snapshots = memoryStore.getAvailableSnapshots();
    
    return {
      success: true,
      snapshots,
      count: snapshots.length,
      message: `Found ${snapshots.length} available snapshots for rollback`,
      timestamp: new Date().toISOString()
    };
  });

// Rollback to a specific snapshot
export const rollbackToSnapshotProcedure = publicProcedure
  .input(z.object({
    snapshotId: z.string()
  }))
  .mutation(async ({ input }) => {
    console.log('[tRPC] cruises.rollbackToSnapshot called with:', input);
    
    try {
      const result = memoryStore.rollbackToSnapshot(input.snapshotId);
      
      if (result.success) {
        // Run data validation after rollback
        const validationCount = memoryStore.fixCruiseDatesAndDuration();
        
        return {
          ...result,
          validationCount,
          message: `${result.message}\n• ${validationCount} data issues fixed after rollback`,
          timestamp: new Date().toISOString()
        };
      } else {
        return {
          ...result,
          timestamp: new Date().toISOString()
        };
      }
      
    } catch (error) {
      console.error('[tRPC] Rollback error:', error);
      return {
        success: false,
        message: `Failed to rollback: ${error}`,
        changes: { cruisesRestored: 0, bookedCruisesRestored: 0, offersRestored: 0 },
        timestamp: new Date().toISOString()
      };
    }
  });

// Delete a specific snapshot
export const deleteSnapshotProcedure = publicProcedure
  .input(z.object({
    snapshotId: z.string()
  }))
  .mutation(async ({ input }) => {
    console.log('[tRPC] cruises.deleteSnapshot called with:', input);
    
    const deleted = memoryStore.deleteSnapshot(input.snapshotId);
    
    return {
      success: deleted,
      message: deleted 
        ? `Snapshot ${input.snapshotId} deleted successfully`
        : `Snapshot ${input.snapshotId} not found`,
      timestamp: new Date().toISOString()
    };
  });

// Clear all snapshots
export const clearAllSnapshotsProcedure = publicProcedure
  .mutation(async () => {
    console.log('[tRPC] cruises.clearAllSnapshots called');
    
    const count = memoryStore.clearAllSnapshots();
    
    return {
      success: true,
      clearedCount: count,
      message: `Cleared ${count} snapshots`,
      timestamp: new Date().toISOString()
    };
  });

// Create manual snapshot
export const createSnapshotProcedure = publicProcedure
  .input(z.object({
    description: z.string()
  }))
  .mutation(async ({ input }) => {
    console.log('[tRPC] cruises.createSnapshot called with:', input);
    
    const snapshotId = memoryStore.createDataSnapshot(input.description, 'manual-fix');
    
    return {
      success: true,
      snapshotId,
      message: `Manual snapshot created: ${input.description}`,
      timestamp: new Date().toISOString()
    };
  });

// Enhanced batch update with rollback
export const batchUpdateWithRollbackProcedure = publicProcedure
  .input(z.object({
    cruiseIds: z.array(z.string()),
    description: z.string().default('Batch cruise update'),
    continueOnError: z.boolean().default(true)
  }))
  .mutation(async ({ input }) => {
    console.log('[tRPC] cruises.batchUpdateWithRollback called with:', input);
    
    // Use the rollback-enabled batch update
    const result = await memoryStore.performBatchWebUpdate(
      input.cruiseIds,
      async (cruiseId: string) => {
        // Simulate individual cruise update
        const cruise = memoryStore.getCruises().find(c => c.id === cruiseId);
        if (!cruise) {
          throw new Error(`Cruise ${cruiseId} not found`);
        }
        
        // Simulate web scraping and update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Simulate 90% success rate
        if (Math.random() < 0.1) {
          throw new Error(`Simulated failure for ${cruise.ship}`);
        }
        
        // Update cruise with mock data
        const updatedCruise = {
          ...cruise,
          dataVerified: true,
          lastVerified: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        memoryStore.updateCruise(cruiseId, updatedCruise);
        return updatedCruise;
      },
      input.description,
      input.continueOnError
    );
    
    return {
      ...result,
      message: result.success 
        ? `✅ BATCH UPDATE COMPLETE\n• ${result.successful}/${result.processed} cruises updated successfully\n• ${result.failed} failures\n• Rollback available via snapshot: ${result.snapshotId}`
        : `❌ BATCH UPDATE FAILED\n• ${result.successful}/${result.processed} cruises updated\n• ${result.failed} failures\n• ${result.rollbackAvailable ? 'Automatic rollback completed' : 'Rollback failed'}`,
      timestamp: new Date().toISOString()
    };
  });

// Test rollback system with simulated failure
export const testRollbackProcedure = publicProcedure
  .input(z.object({
    simulateFailure: z.boolean().default(true),
    description: z.string().default('Rollback system test')
  }))
  .mutation(async ({ input }) => {
    console.log('[tRPC] cruises.testRollback called with:', input);
    
    // Use rollback-enabled update with intentional failure
    const result = await memoryStore.performWebDataUpdate(async () => {
      console.log('[Test] Starting test update...');
      
      // Make some changes to test rollback
      const cruises = memoryStore.getCruises();
      if (cruises.length > 0) {
        const testCruise = cruises[0];
        memoryStore.updateCruise(testCruise.id, {
          ...testCruise,
          itineraryName: 'TEST ROLLBACK - This should be reverted',
          updatedAt: new Date().toISOString()
        });
      }
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (input.simulateFailure) {
        throw new Error('Simulated failure to test rollback system');
      }
      
      return { success: true, message: 'Test update completed successfully' };
    }, input.description);
    
    return {
      ...result,
      testResult: input.simulateFailure 
        ? 'Rollback system test completed - failure simulated and rollback should have occurred'
        : 'Rollback system test completed - update succeeded, no rollback needed',
      timestamp: new Date().toISOString()
    };
  });