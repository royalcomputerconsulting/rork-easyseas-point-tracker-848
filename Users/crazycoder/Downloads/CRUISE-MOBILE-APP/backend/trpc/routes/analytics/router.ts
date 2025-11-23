import { router } from '../../create-context';
import { contextProcedure } from './context/route';

export const analyticsRouter = router({
  context: contextProcedure,
});
