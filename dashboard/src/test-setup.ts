/**
 * Vitest test setup — runs before all tests.
 *
 * Sets required environment variables so modules that read
 * process.env at import time get deterministic values.
 */

// Vitest locks process.env, so we only set writable properties
// SESSION_SECRET and AGENT_API_KEY are what the app actually needs
process.env.SESSION_SECRET = 'test-secret-key-for-testing-only-32chars';
process.env.AGENT_API_KEY = 'test-agent-key';
process.env.LOG_LEVEL = 'error';
// NODE_ENV is set by vitest itself via the environment option
