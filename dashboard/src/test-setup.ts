/**
 * Vitest test setup — runs before all tests.
 *
 * Sets required environment variables so modules that read
 * process.env at import time get deterministic values.
 */
process.env.SESSION_SECRET = 'test-secret-key-for-testing-only-32chars';
process.env.AGENT_API_KEY = 'test-agent-key';
process.env.LOG_LEVEL     = 'error';   // Suppress logs during tests
process.env.NODE_ENV      = 'test';
