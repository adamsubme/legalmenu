// OpenClaw Gateway WebSocket Client

import { EventEmitter } from 'events';
import type { OpenClawMessage, OpenClawSessionInfo } from '../types';
import { logger } from '@/lib/logger';
import { metrics } from '@/lib/metrics';

function getGatewayUrl() {
  return process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789';
}
function getGatewayToken() {
  return process.env.OPENCLAW_GATEWAY_TOKEN || '';
}

// ── Configurable timeouts ───────────────────────────────────────────────────────
const CONNECT_TIMEOUT_MS  = Number(process.env.OPENCLAW_CONNECT_TIMEOUT_MS)  || 10_000;
const REQUEST_TIMEOUT_MS  = Number(process.env.OPENCLAW_REQUEST_TIMEOUT_MS)  || 30_000;
const RECONNECT_BASE_MS   = Number(process.env.OPENCLAW_RECONNECT_BASE_MS)   ||  2_000;
const RECONNECT_MAX_MS    = Number(process.env.OPENCLAW_RECONNECT_MAX_MS)    || 60_000;
const MAX_RECONNECT_ATTEMPTS = Number(process.env.OPENCLAW_MAX_RECONNECT_ATTEMPTS) || 20;

export class OpenClawClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private messageId = 0;
  private pendingRequests = new Map<string | number, {
    resolve: (value: unknown) => void;
    reject:  (error: Error)  => void;
    timeout: NodeJS.Timeout;
  }>();
  private connected    = false;
  private authenticated = false;
  private connecting: Promise<void> | null = null;
  private autoReconnect = true;
  private token: string;

  constructor(private url: string = getGatewayUrl(), token: string = getGatewayToken()) {
    super();
    this.token = token;
    this.on('error', () => {});
  }

  // ── Connection ───────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.connecting) {
      return this.connecting;
    }

    this.connecting = new Promise((resolve, reject) => {
      try {
        if (this.ws) {
          this.ws.onclose   = null;
          this.ws.onerror   = null;
          this.ws.onmessage = null;
          this.ws.onopen    = null;
          if (
            this.ws.readyState === WebSocket.OPEN ||
            this.ws.readyState === WebSocket.CONNECTING
          ) {
            this.ws.close();
          }
          this.ws = null;
        }

        const wsUrl = new URL(this.url);
        if (this.token) {
          wsUrl.searchParams.set('token', this.token);
        }
        const redacted = wsUrl.toString().replace(/token=[^&]+/, 'token=***');
        const origin = process.env.MISSION_CONTROL_ORIGIN || 'http://mission-control:3000';

        logger.debug({ event: 'openclaw_connecting', url: redacted });
        this.ws = new WebSocket(wsUrl.toString(), {
          headers: { Origin: origin },
        } as unknown as string[]);

        const connectionTimeout = setTimeout(() => {
          if (!this.connected) {
            this.ws?.close();
            reject(new Error('Connection timeout'));
          }
        }, CONNECT_TIMEOUT_MS);

        this.ws.onopen = () => {
          clearTimeout(connectionTimeout);
          logger.debug({ event: 'openclaw_websocket_opened' });
        };

        this.ws.onclose = (event) => {
          clearTimeout(connectionTimeout);
          const wasConnected = this.connected;
          this.connected    = false;
          this.authenticated = false;
          this.connecting   = null;
          this.emit('disconnected');

          logger.info({
            event: 'openclaw_disconnected',
            code:     event.code,
            reason:   event.reason,
            wasClean: event.wasClean,
          });

          this.rejectAllPending('Connection closed');

          if (this.autoReconnect && wasConnected) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(connectionTimeout);
          logger.error({ event: 'openclaw_websocket_error' }, error);
          this.emit('error', error);
          if (!this.connected) {
            this.connecting = null;
            reject(new Error('Failed to connect to OpenClaw Gateway'));
          }
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data as string) as OpenClawMessage & Record<string, unknown>;
            this.handleIncoming(data, resolve, reject);
          } catch (err) {
            logger.error({ event: 'openclaw_parse_error' }, err);
          }
        };
      } catch (err) {
        this.connecting = null;
        reject(err);
      }
    });

    return this.connecting;
  }

  private handleIncoming(
    data: OpenClawMessage & Record<string, unknown>,
    connectResolve: (value: void) => void,
    connectReject: (err: Error) => void
  ): void {
    // Challenge-response auth
    if (data.type === 'event' && data.event === 'connect.challenge') {
      logger.debug({ event: 'openclaw_challenge_received' });
      const requestId = crypto.randomUUID();
      const response = {
        type: 'req',
        id:   requestId,
        method: 'connect',
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id:         'openclaw-control-ui',
            version:    '2026.2.25',
            platform:   'web',
            mode:       'ui',
            displayName: 'Mission Control',
          },
          role:   'operator',
          scopes: [
            'operator.read',
            'operator.write',
            'operator.admin',
            'operator.approvals',
            'operator.pairing',
          ],
          auth: { token: this.token },
        },
      };

      this.pendingRequests.set(requestId, {
        resolve: () => {
          this.connected    = true;
          this.authenticated = true;
          this.connecting   = null;
          this.reconnectAttempts = 0;
          this.emit('connected');
          logger.info({ event: 'openclaw_authenticated' });
          connectResolve();
        },
        reject: (err: Error) => {
          this.connecting = null;
          this.ws?.close();
          connectReject(new Error(`Authentication failed: ${err.message}`));
        },
        timeout: setTimeout(() => {
          if (this.pendingRequests.has(requestId)) {
            this.pendingRequests.delete(requestId);
            connectReject(new Error('Authentication timeout'));
          }
        }, REQUEST_TIMEOUT_MS),
      });

      logger.debug({ event: 'openclaw_sending_challenge_response' });
      this.ws!.send(JSON.stringify(response));
      return;
    }

    // RPC responses — new format (type: "res")
    if (data.type === 'res' && data.id !== undefined) {
      const requestId = data.id as string | number;
      this.settleRequest(requestId, data);
      return;
    }

    // Legacy JSON-RPC responses
    const legacyId = data.id as string | number | undefined;
    if (legacyId !== undefined && this.pendingRequests.has(legacyId)) {
      this.settleRequest(legacyId, data);
      return;
    }

    // Events / notifications
    if (data.method) {
      this.emit('notification', data);
      this.emit(data.method as string, data.params);
    }
  }

  private settleRequest(
    requestId: string | number,
    data: Record<string, unknown>
  ): void {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(requestId);

    const payload = data.payload as { ok?: boolean; error?: { message?: string } } & Record<string, unknown>;

    if (payload.ok === false && payload.error) {
      pending.reject(new Error(payload.error.message ?? 'Request failed'));
    } else {
      pending.resolve(payload);
    }
  }

  /** Reject all pending requests — called on disconnect */
  private rejectAllPending(reason: string): void {
    for (const [id, pending] of Array.from(this.pendingRequests.entries())) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(reason));
    }
    this.pendingRequests.clear();
  }

  // ── Reconnect with exponential backoff + circuit breaker ────────────────────

  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.autoReconnect) return;

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.error({
        event: 'openclaw_max_reconnect_attempts',
        maxAttempts: MAX_RECONNECT_ATTEMPTS,
      }, 'Circuit breaker open — max reconnect attempts reached');
      this.emit('circuit_open');
      return;
    }

    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** this.reconnectAttempts,
      RECONNECT_MAX_MS
    );
    this.reconnectAttempts++;

    logger.info({
      event:          'openclaw_reconnect_scheduled',
      attempt:        this.reconnectAttempts,
      delayMs:        delay,
    });

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (!this.autoReconnect) return;

      logger.debug({ event: 'openclaw_reconnect_attempt' });
      try {
        await this.connect();
      } catch {
        this.scheduleReconnect();
      }
    }, delay);
  }

  // ── RPC calls ────────────────────────────────────────────────────────────────

  async call<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.ws || !this.connected || !this.authenticated) {
      throw new Error('Not connected to OpenClaw Gateway');
    }

    const id      = crypto.randomUUID();
    const message = { type: 'req', id, method, params };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, { resolve: resolve as (value: unknown) => void, reject, timeout });
      this.ws!.send(JSON.stringify(message));
    });
  }

  // ── Session management ───────────────────────────────────────────────────────

  async listSessions(): Promise<OpenClawSessionInfo[]> {
    return this.call<OpenClawSessionInfo[]>('sessions.list');
  }

  async getSessionHistory(sessionId: string): Promise<unknown[]> {
    return this.call<unknown[]>('sessions.history', { session_id: sessionId });
  }

  async getChatHistory(
    sessionKey: string,
    limit = 100
  ): Promise<{ role: string; content: string }[]> {
    const result = await this.call<{ messages?: { role: string; content: string }[] }>(
      'chat.history',
      { sessionKey, limit }
    );
    return Array.isArray(result?.messages) ? result.messages : [];
  }

  async sendMessage(sessionId: string, content: string): Promise<void> {
    await this.call('sessions.send', { session_id: sessionId, content });
  }

  async createSession(channel: string, peer?: string): Promise<OpenClawSessionInfo> {
    return this.call<OpenClawSessionInfo>('sessions.create', { channel, peer });
  }

  async listNodes(): Promise<unknown[]> {
    return this.call<unknown[]>('node.list');
  }

  async describeNode(nodeId: string): Promise<unknown> {
    return this.call('node.describe', { node_id: nodeId });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  disconnect(): void {
    this.autoReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.rejectAllPending('Client disconnected');
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.connected    = false;
    this.authenticated = false;
    this.connecting   = null;
  }

  isConnected(): boolean {
    return (
      this.connected &&
      this.authenticated &&
      this.ws?.readyState === WebSocket.OPEN
    );
  }

  setAutoReconnect(enabled: boolean): void {
    this.autoReconnect = enabled;
    if (!enabled && this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────────

let clientInstance: OpenClawClient | null = null;

export function getOpenClawClient(): OpenClawClient {
  if (!clientInstance) {
    clientInstance = new OpenClawClient(getGatewayUrl(), getGatewayToken());
  }
  return clientInstance;
}
