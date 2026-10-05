/** Wraps an async route so a rejected promise reaches the error middleware. */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function httpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}

const badRequest = (msg, details) => httpError(400, msg, details);
const notFound = (msg) => httpError(404, msg);

/** Parses a positive money amount from a form body, tolerating Bengali digits. */
function parseAmount(input) {
  if (input === null || input === undefined || input === '') return 0;
  const bn = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
  const normalized = String(input)
    .replace(/[০-৯]/g, (d) => bn[d])
    .replace(/[৳,\s]/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

module.exports = { asyncHandler, httpError, badRequest, notFound, parseAmount };
