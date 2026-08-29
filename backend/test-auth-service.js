import { connectDB } from "./src/config/db.js";
import { createUser, authenticateUser } from "./src/services/userService.js";
import User from "./src/models/user.model.js";

async function runTest() {
  console.log("Connecting to DB...");
  await connectDB();

  const testUser = {
    firstName: "Test",
    lastName: "User",
    email: "test.user.mongo@example.com",
    password: "password123"
  };

  try {
    // Cleanup if exists
    await User.deleteOne({ email: testUser.email });

    console.log("Creating user...");
    const created = await createUser(testUser);
    console.log("User created:", created.email);

    if (created.firstName !== testUser.firstName) throw new Error("First Name mismatch");

    console.log("Authenticating user...");
    const auth = await authenticateUser({ email: testUser.email, password: testUser.password });
    console.log("Authenticated successfully:", auth.email);

    console.log("Testing invalid password...");
    try {
      await authenticateUser({ email: testUser.email, password: "wrongpassword" });
      throw new Error("Should have failed invalid password");
    } catch (e) {
      if (e.message !== "Invalid credentials") throw e;
      console.log("Invalid password handled correctly.");
    }

    // Cleanup
    await User.deleteOne({ email: testUser.email });
    console.log("Cleanup done.");
    
    console.log("VERIFICATION PASSED");
    process.exit(0);

  } catch (error) {
    console.error("VERIFICATION FAILED", error);
    process.exit(1);
  }
}

runTest();
