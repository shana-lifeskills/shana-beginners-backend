function errorHandler(err, req, res, next) {
  // A foreign key violation means the request referenced something that doesn't exist —
  // the caller's mistake, not a server fault. Routes should validate first; this is the
  // safety net so one slipping through is still a clean 400, not a 500 and a stack dump.
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    console.warn(`400 ${req.method} ${req.originalUrl}: ${err.parent?.detail ?? err.message}`);
    return res.status(400).json({ message: 'That request refers to something that does not exist.' });
  }

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // Full stack traces only for real server faults; a client mistake gets one line.
  if (status >= 500) console.error(err);
  else console.warn(`${status} ${req.method} ${req.originalUrl}: ${message}`);

  res.status(status).json({ message });
}

module.exports = { errorHandler };
