const policy = [
  "default-src 'self'",
  "script-src 'self'",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

module.exports = function securityHeaders(req, res, next) {
  res.setHeader('Content-Security-Policy', policy);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  // Respuestas de sesión y negocio: nunca almacenar en caché compartida.
  if (!['GET', 'HEAD'].includes(req.method) || ['/perfil', '/usuarios', '/health'].includes(req.path)) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
};
