import { createUser, authenticateUser } from "../services/userService.js";
import { signToken } from "../utils/jwt.js";

export async function register(req, res, next) {
  try {
    const { email, password, fullName } = req.body;
    const user = await createUser({ email, password, fullName });
    const token = signToken({ id: user.id, email: user.email });
    res.status(201).json({ token, user: { id: user.id, email, fullName } });
  } catch (err) {
    err.status = 400;
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await authenticateUser({ email, password });
    const token = signToken({ id: user.id, email: user.email });
    res.json({ token, user: { id: user.id, email, fullName: user.fullName } });
  } catch (err) {
    err.status = 401;
    next(err);
  }
}
