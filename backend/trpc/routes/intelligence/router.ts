import { createTRPCRouter } from '../../create-context';
import { getExpiringOffersProcedure, autoMatchOffersProcedure } from './offer-alerts/route';
import { 
  getBookingWindowPredictionProcedure, 
  getAllBookingWindowsProcedure, 
  trackPriceDropAlertsProcedure 
} from './booking-predictor/route';

export const intelligenceRouter = createTRPCRouter({
  offerAlerts: createTRPCRouter({
    getExpiring: getExpiringOffersProcedure,
    autoMatch: autoMatchOffersProcedure
  }),
  bookingPredictor: createTRPCRouter({
    getCruise: getBookingWindowPredictionProcedure,
    getAll: getAllBookingWindowsProcedure,
    getPriceDropAlerts: trackPriceDropAlertsProcedure
  })
});
