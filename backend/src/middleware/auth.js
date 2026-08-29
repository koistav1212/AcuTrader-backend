import { verifyToken } from "../utils/jwt.js";

export function auth(required = true) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      if (!required) return next();
      return res.status(401).json({ message: "Missing token" });
    }

    try {
      const decoded = verifyToken(token);
      req.user = { id: decoded.id, email: decoded.email };
      next();
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  };
}
