const crypto = require('crypto');

/**
 * Request Performance Tracing & Structured Logging Middleware
 * Records start time, status code, response latency (ms), and correlation IDs.
 */
function requestLogger(req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomBytes(8).toString('hex');
  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);

  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1e6;
    
    // Formatting structured log entry
    const logData = {
      timestamp: new Date().toISOString(),
      requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      latencyMs: durationMs.toFixed(2),
      userAgent: req.headers['user-agent'] || 'unknown',
    };

    if (process.env.NODE_ENV !== 'test') {
      const color = res.statusCode >= 500 ? '\x1b[31m' : res.statusCode >= 400 ? '\x1b[33m' : '\x1b[32m';
      const reset = '\x1b[0m';
      console.log(`[${logData.timestamp}] ${logData.method} ${logData.url} ${color}${logData.status}${reset} - ${logData.latencyMs}ms (${requestId})`);
    }
  });

  next();
}

module.exports = requestLogger;
