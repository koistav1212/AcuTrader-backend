export function errorHandler(err, _req, res, _next) {
  console.error(err);
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";
  
  res.status(status).json({
    success: false,
    status,
    message,
    // Optional: Include stack trace in dev mode only if needed
    // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
}
