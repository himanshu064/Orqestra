// Load .env so integration tests can reach the Neon database.
import "dotenv/config";

// Never send real emails from the test suite  force the mock path in the approval engine.
delete process.env.EMAIL_API_KEY;
