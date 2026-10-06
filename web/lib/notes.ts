import { notFound, isObjectId } from './api-helpers';
import Note from './models/Note';
import { scopeFilter, type Scope } from './scope';

/** Shape the notes routes read from a lean or hydrated document. */
export type NoteLike = {
  _id: unknown;
  text: string;
  done?: boolean | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

/** The wire shape the Android client parses. */
export function noteView(n: NoteLike) {
  return {
    id: String(n._id),
    text: n.text,
    done: Boolean(n.done),
    createdAt: n.createdAt ? new Date(n.createdAt).toISOString() : null,
    updatedAt: n.updatedAt ? new Date(n.updatedAt).toISOString() : null,
  };
}

/** Loads one note inside the caller's book, or 404s. */
export async function findNote(scope: Scope, id: string) {
  if (!isObjectId(id)) throw notFound('নোটটি পাওয়া যায়নি');
  const doc = await Note.findOne({ ...scopeFilter(scope), _id: id });
  if (!doc) throw notFound('নোটটি পাওয়া যায়নি');
  return doc;
}
