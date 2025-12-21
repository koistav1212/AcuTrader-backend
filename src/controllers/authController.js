import { createUser, authenticateUser } from "../services/userService.js";
import { signToken } from "../utils/jwt.js";


export async function register(req, res, next) {
  try {
    const { email, password, firstName, lastName } = req.body;
    
    // Input validation
    if (!email || !password || !firstName || !lastName) {
      const error = new Error("Missing required fields");
      error.status = 400;
      throw error;
    }

    const user = await createUser({ email, password, firstName, lastName });
    const token = signToken({ id: user._id, email: user.email });
    res.status(201).json({ 
      token, 
      user: { 
        id: user._id, 
        email: user.email, 
        firstName: user.firstName,
        lastName: user.lastName 
      } 
    });
  } catch (err) {
    // Check for mongoose duplicate key error
    if (err.code === 11000) {
      err.message = "Email already registered";
      err.status = 400;
    } else if (!err.status) {
       err.status = 400;
    }
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      const error = new Error("Missing email or password");
      error.status = 400;
      throw error;
    }

    const user = await authenticateUser({ email, password });
    const token = signToken({ id: user._id, email: user.email });
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        email: user.email, 
        firstName: user.firstName, 
        lastName: user.lastName 
      } 
    });
  } catch (err) {
    if (err.message === "User not found") {
      err.status = 404;
    } else if (err.message === "Invalid credentials") {
      err.status = 401;
    } else {
      err.status = 400;
    }
    next(err);
  }
}
