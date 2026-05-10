import mongoose from 'mongoose';
import { Event } from '../../models/Event';
import { Result } from '../../models/Result';
import { EVENTS_CODES } from '../../types/codes';
import { NotFoundError } from '../../types/errors';

export interface ResultResponse {
  id: string;
  position?: number;
  positionGender?: number;
  positionAge?: number;
  bib?: string;
  name?: string;
  city?: string;
  distance?: string;
  finishTime?: string;
  paceMinKm?: string;
}

function formatResult(doc: {
  _id: mongoose.Types.ObjectId | { toString(): string };
  position?: number;
  positionGender?: number;
  positionAge?: number;
  bib?: string;
  name?: string;
  city?: string;
  distance?: string;
  finishTime?: string;
  paceMinKm?: string;
}): ResultResponse {
  const r: ResultResponse = { id: doc._id.toString() };
  if (doc.position !== undefined) r.position = doc.position;
  if (doc.positionGender !== undefined) r.positionGender = doc.positionGender;
  if (doc.positionAge !== undefined) r.positionAge = doc.positionAge;
  if (doc.bib !== undefined) r.bib = doc.bib;
  if (doc.name !== undefined) r.name = doc.name;
  if (doc.city !== undefined) r.city = doc.city;
  if (doc.distance !== undefined) r.distance = doc.distance;
  if (doc.finishTime !== undefined) r.finishTime = doc.finishTime;
  if (doc.paceMinKm !== undefined) r.paceMinKm = doc.paceMinKm;
  return r;
}

/**
 * Returns finisher results for an event ordered by overall position.
 * Returns an empty array when no results have been loaded yet.
 * Throws 404 if the event itself does not exist.
 */
export async function getEventResults(eventId: string): Promise<ResultResponse[]> {
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    throw new NotFoundError('Invalid event ID', EVENTS_CODES.ERROR_EVENTS_INVALID_ID);
  }

  const event = await Event.findById(eventId).lean();
  if (!event) {
    throw new NotFoundError('Event not found', EVENTS_CODES.ERROR_EVENTS_NOT_FOUND);
  }

  const results = await Result.find({ eventId }).sort({ position: 1 }).lean();

  return results.map(formatResult);
}

export default { getEventResults };
