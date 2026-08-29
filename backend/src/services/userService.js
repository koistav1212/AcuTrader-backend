import bcrypt from "bcryptjs";
import User from "../models/user.model.js";

const SALT_ROUNDS = 10;

export async function createUser({ email, password, firstName, lastName }) {
  const existing = await User.findOne({ email });
  if (existing) throw new Error("Email already registered");

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  // Although the schema has 'password', the original code used 'passwordHash'.
  // However, the schema I defined has 'password'. I will stick to 'password' field in schema
  // which stores the hash.
  
  const user = await User.create({
    email,
    password: passwordHash,
    firstName,
    lastName
  });

  return user;
}

export async function authenticateUser({ email, password }) {
  const user = await User.findOne({ email });
  if (!user) throw new Error("User not found");

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new Error("Invalid credentials");

  return user;
}

export async function getUserProfile(userId) {
  const user = await User.findById(userId).select("-password");
  return user;
}
