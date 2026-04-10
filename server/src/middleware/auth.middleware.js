const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Token yoxdur" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token etibarsızdır" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user?.role) {
      return res.status(403).json({ message: "Role tapılmadı" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Bu əməliyyata icazə yoxdur" });
    }

    next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
};
