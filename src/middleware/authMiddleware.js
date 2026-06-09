function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/auth/login");
  }
  next();
}

function requireRole(role) {
  return function (req, res, next) {
    if (!req.session.user || req.session.user.role !== role) {
      return res.status(403).send("Forbidden: You don't have access to this resource.");
    }
    next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
};
