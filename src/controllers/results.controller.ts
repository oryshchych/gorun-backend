import { Request, Response } from 'express';
import resultsService from '../services/results/results.service';

/**
 * GET /api/events/:id/results
 * Public race results for an event.
 * Returns [] when no results are available; 404 if the event does not exist.
 */
export const getEventResults = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.validatedParams as { id: string };

  const results = await resultsService.getEventResults(id);

  res.status(200).json({
    success: true,
    data: results,
  });
};
