import { router } from "../../create-context";
import { addCasinoActivityProcedure } from "./add-activity/route";
import { getCasinoTotalProcedure } from "./get-total/route";

export const casinoRouter = router({
  addActivity: addCasinoActivityProcedure,
  getTotal: getCasinoTotalProcedure,
});
