// Loads variables from a local .env file (if present) before anything reads process.env.
try {
  process.loadEnvFile();
} catch {
  // No .env file — rely on the real environment.
}
