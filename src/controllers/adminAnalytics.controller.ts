import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import adminAnalyticsService from '../services/adminAnalytics/adminAnalytics.service';
import type {
  AnalyticsQuery,
  AnalyticsScope,
} from '../services/adminAnalytics/adminAnalytics.types';
import { ADMIN_ANALYTICS_CODES } from '../types/codes';

/** Turn the validated query into a concrete scope shared by all handlers. */
function buildScope(q: AnalyticsQuery): AnalyticsScope {
  const { start, end } = adminAnalyticsService.resolveRange(q.preset, q.from, q.to);
  const scope: AnalyticsScope = { start, end };
  if (q.eventId) scope.eventId = q.eventId;
  return scope;
}

export const getAnalyticsSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  const data = await adminAnalyticsService.getSummary(
    buildScope(req.validatedQuery as AnalyticsQuery)
  );
  res.status(200).json({
    success: true,
    code: ADMIN_ANALYTICS_CODES.SUCCESS_ANALYTICS_SUMMARY_RETRIEVED,
    data,
  });
};

export const getAnalyticsTimeseries = async (req: AuthRequest, res: Response): Promise<void> => {
  const data = await adminAnalyticsService.getTimeseries(
    buildScope(req.validatedQuery as AnalyticsQuery)
  );
  res.status(200).json({
    success: true,
    code: ADMIN_ANALYTICS_CODES.SUCCESS_ANALYTICS_TIMESERIES_RETRIEVED,
    data,
  });
};

export const getAnalyticsDemographics = async (req: AuthRequest, res: Response): Promise<void> => {
  const data = await adminAnalyticsService.getDemographics(
    buildScope(req.validatedQuery as AnalyticsQuery)
  );
  res.status(200).json({
    success: true,
    code: ADMIN_ANALYTICS_CODES.SUCCESS_ANALYTICS_DEMOGRAPHICS_RETRIEVED,
    data,
  });
};

export const getAnalyticsByEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  const data = await adminAnalyticsService.getByEvent(
    buildScope(req.validatedQuery as AnalyticsQuery)
  );
  res.status(200).json({
    success: true,
    code: ADMIN_ANALYTICS_CODES.SUCCESS_ANALYTICS_BY_EVENT_RETRIEVED,
    data,
  });
};
