/**
 * useSSE Hook
 * Establishes and maintains Server-Sent Events connection for real-time updates.
 *
 * Optional eventHandler param lets components intercept SSE events directly
 * (useful when the component owns its own task state, like Cases page).
 */

'use client';

import { useEffect, useRef } from 'react';
import { useMissionControl } from '@/lib/store';
import { debug } from '@/lib/debug';
import type { SSEEvent, Task, EventType } from '@/lib/types';

export function useSSE(eventHandler?: (event: SSEEvent) => void) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const eventHandlerRef = useRef(eventHandler);
  eventHandlerRef.current = eventHandler;

  const {
    updateTask,
    addTask,
    addEvent,
    setIsOnline,
    selectedTask,
    setSelectedTask,
  } = useMissionControl();

  useEffect(() => {
    let isConnecting = false;

    const connect = () => {
      if (isConnecting || eventSourceRef.current?.readyState === EventSource.OPEN) {
        return;
      }

      isConnecting = true;
      debug.sse('Connecting to event stream...');

      const eventSource = new EventSource('/api/events/stream');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        debug.sse('Connected');
        setIsOnline(true);
        isConnecting = false;
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
      };

      eventSource.onmessage = (event) => {
        try {
          if (event.data.startsWith(':')) {
            return;
          }

          const sseEvent: SSEEvent = JSON.parse(event.data);
          debug.sse(`Received event: ${sseEvent.type}`, sseEvent.payload);

          // Route to component's eventHandler first (if provided)
          if (eventHandlerRef.current) {
            eventHandlerRef.current(sseEvent);
          }

          switch (sseEvent.type) {
            case 'task_created':
              debug.sse('Adding new task to store', { id: (sseEvent.payload as Task).id });
              addTask(sseEvent.payload as Task);
              break;

            case 'task_updated':
              const incomingTask = sseEvent.payload as Task;
              debug.sse('Task update received', {
                id: incomingTask.id,
                status: incomingTask.status,
                title: incomingTask.title
              });
              updateTask(incomingTask);

              if (selectedTask?.id === incomingTask.id) {
                debug.sse('Also updating selectedTask for modal');
                setSelectedTask(incomingTask);
              }
              break;

            case 'activity_logged':
              debug.sse('Activity logged', sseEvent.payload);
              break;

            case 'deliverable_added':
              debug.sse('Deliverable added', sseEvent.payload);
              break;

            case 'agent_spawned':
              debug.sse('Agent spawned', sseEvent.payload);
              break;

            case 'agent_completed':
              debug.sse('Agent completed', sseEvent.payload);
              break;

            case 'event_added':
              addEvent(sseEvent.payload as { id: string; type: EventType; task_id?: string; message: string; created_at: string });
              break;

            case 'task_deleted':
              debug.sse('Task deleted', sseEvent.payload);
              break;

            default:
              debug.sse('Unknown event type', sseEvent);
          }
        } catch (error) {
          console.error('[SSE] Error parsing event:', error);
        }
      };

      eventSource.onerror = (error) => {
        debug.sse('Connection error', error);
        setIsOnline(false);
        isConnecting = false;

        eventSource.close();
        eventSourceRef.current = null;

        // SSE stream returns 429 when rate limited. The EventSource doesn't
        // give us the HTTP status code, but we can detect rate limiting by
        // the error pattern. If reconnecting too frequently, assume rate limit.
        reconnectTimeoutRef.current = setTimeout(() => {
          debug.sse('Attempting to reconnect...');
          connect();
        }, 5000);
      };
    };

    connect();

    return () => {
      if (eventSourceRef.current) {
        debug.sse('Disconnecting...');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [addTask, addEvent, updateTask, setIsOnline, selectedTask, setSelectedTask]);
}
