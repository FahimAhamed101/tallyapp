import mongoose, { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';

/**
 * One line in a shopkeeper's ব্যবসার নোট — the checklist behind the home tab's
 * third tile.
 *
 * Deliberately tiny: the reference app's note screen is a to-do list (a
 * checkbox and a line of text), not a rich-text notebook, so that is all that
 * is stored. Scoped to one book exactly like stock items, so switching
 * businesses switches the list.
 */
const NoteSchema = new Schema(
  {
    owner: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    business: { type: Types.ObjectId, ref: 'Business', required: true, index: true },
    text: { type: String, required: true, trim: true },
    /** Ticked off. Kept rather than deleted, as in the reference app. */
    done: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// The list is "everything in this book, newest first".
NoteSchema.index({ owner: 1, business: 1, createdAt: -1 });

export type NoteDoc = InferSchemaType<typeof NoteSchema>;

export type NoteModel = Model<NoteDoc>;

export const Note = (mongoose.models.Note as NoteModel) ||
  (model('Note', NoteSchema) as unknown as NoteModel);

export default Note;
