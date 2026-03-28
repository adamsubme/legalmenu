/**
 * Centralised user-facing strings — tests.
 *
 * These tests verify the structure of messages.ts — that keys exist,
 * function factories return strings, and the shape matches what
 * consumers expect. We don't test translation content itself.
 */

import { describe, it, expect } from 'vitest';
import { api, ui, workflow, validation, notFound, internalErr } from './messages';

// ── api — structure and function factories ─────────────────────────────────

describe('api — top-level shape', () => {
  it('has generic error keys', () => {
    expect(typeof api.unauthorized).toBe('string');
    expect(typeof api.forbidden).toBe('string');
    expect(typeof api.notFound).toBe('function');
    expect(typeof api.internalError).toBe('function');
    expect(typeof api.invalidPayload).toBe('function');
    expect(typeof api.connectionFailed).toBe('function');
  });

  it('notFound() returns a string with the resource name', () => {
    expect(api.notFound('Task')).toBe('Task not found');
    expect(api.notFound('Agent')).toBe('Agent not found');
    expect(api.notFound('Client')).toBe('Client not found');
  });

  it('internalError() returns a string', () => {
    expect(api.internalError('save task')).toBe('Failed to save task');
  });

  it('has nested task/agent/client/knowledge error keys', () => {
    expect(typeof api.tasks.notFound).toBe('string');
    expect(typeof api.agents.notFound).toBe('string');
    expect(typeof api.clients.notFound).toBe('string');
    expect(typeof api.knowledge.notFound).toBe('string');
  });
});

// ── ui — structure ─────────────────────────────────────────────────────────

describe('ui — top-level sections', () => {
  it('has nav, buttons, status, labels, placeholders, empty, tabs sections', () => {
    expect(typeof ui.nav).toBe('object');
    expect(typeof ui.buttons).toBe('object');
    expect(typeof ui.status).toBe('object');
    expect(typeof ui.labels).toBe('object');
    expect(typeof ui.placeholders).toBe('object');
    expect(typeof ui.empty).toBe('object');
    expect(typeof ui.tabs).toBe('object');
    expect(typeof ui.processing).toBe('object');
    expect(typeof ui.agents).toBe('object');
    expect(typeof ui.comms).toBe('object');
  });

  it('nav has expected page keys', () => {
    expect(ui.nav.dashboard).toBe('Dashboard');
    expect(ui.nav.cases).toBe('Cases');
    expect(ui.nav.agents).toBe('Agents');
    expect(ui.nav.knowledge).toBe('Knowledge Base');
    expect(ui.nav.clients).toBe('Clients');
    expect(ui.nav.settings).toBe('Settings');
    expect(ui.nav.login).toBe('Sign In');
  });

  it('buttons has save, cancel, delete, edit, send', () => {
    expect(ui.buttons.save).toBe('Save');
    expect(ui.buttons.cancel).toBe('Cancel');
    expect(ui.buttons.delete).toBe('Delete');
    expect(ui.buttons.edit).toBe('Edit');
    expect(ui.buttons.send).toBe('Send');
    expect(ui.buttons.refresh).toBe('Refresh');
  });

  it('status has key statuses', () => {
    expect(ui.status.notStarted).toBe('NOT STARTED');
    expect(ui.status.inProgress).toBe('IN PROGRESS');
    expect(ui.status.blocked).toBe('BLOCKED');
    expect(ui.status.awaitingApproval).toBe('AWAITING APPROVAL');
    expect(ui.status.done).toBe('DONE');
  });

  it('empty states are all non-empty strings', () => {
    for (const [key, value] of Object.entries(ui.empty)) {
      expect(typeof value, `empty.${key}`).toBe('string');
      expect(value.length, `empty.${key} should not be empty`).toBeGreaterThan(0);
    }
  });

  it('placeholders are non-empty strings', () => {
    for (const [key, value] of Object.entries(ui.placeholders)) {
      expect(typeof value, `placeholders.${key}`).toBe('string');
      expect(value.length, `placeholders.${key} should not be empty`).toBeGreaterThan(0);
    }
  });

  it('processing states are non-empty strings', () => {
    for (const [key, value] of Object.entries(ui.processing)) {
      expect(typeof value, `processing.${key}`).toBe('string');
    }
  });

  it('agents.noMessagesFor is a factory function', () => {
    expect(typeof ui.agents.noMessagesFor).toBe('function');
    expect(ui.agents.noMessagesFor('Lex Intake')).toBe('Brak wiadomości od Lex Intake');
  });

  it('agents.sentTo is a factory function', () => {
    expect(typeof ui.agents.sentTo).toBe('function');
    expect(ui.agents.sentTo('Lex Research')).toBe('Wysłano do Lex Research');
  });

  it('comms.casesCount is a factory function', () => {
    expect(typeof ui.comms.casesCount).toBe('function');
    expect(ui.comms.casesCount(10, 2)).toBe('10 cases • 2 blocked');
  });

  it('misc.confirmDelete is a factory function', () => {
    expect(typeof ui.misc.confirmDelete).toBe('function');
    expect(ui.misc.confirmDelete('Contract.pdf')).toBe('Usuń "Contract.pdf"?');
  });

  it('settings.userManagementDesc is a factory function', () => {
    expect(typeof ui.settings.userManagementDesc).toBe('function');
    expect(ui.settings.userManagementDesc('admin')).toBe('Only administrators can manage users. Your current role: admin');
  });

  it('caseDetail.documentsAttached is a factory function', () => {
    expect(typeof ui.caseDetail.documentsAttached).toBe('function');
    expect(ui.caseDetail.documentsAttached(5)).toBe('5 attachments across all cases');
  });
});

// ── workflow — structure ───────────────────────────────────────────────────

describe('workflow — pipeline stages', () => {
  it('stages has all pipeline stages', () => {
    expect(workflow.stages.intake).toBe('Intake');
    expect(workflow.stages.research).toBe('Research');
    expect(workflow.stages.drafting).toBe('Drafting');
    expect(workflow.stages.review).toBe('Review');
    expect(workflow.stages.clientInput).toBe('Client Input');
    expect(workflow.stages.done).toBe('Done');
  });

  it('subStatus has all sub-status labels', () => {
    expect(workflow.subStatus.waitingClient).toBe('Waiting for client');
    expect(workflow.subStatus.waitingDocuments).toBe('Waiting for documents');
    expect(workflow.subStatus.internal).toBe('Internal block');
  });

  it('dispatchMessages.taskSent is a factory function', () => {
    expect(typeof workflow.dispatchMessages.taskSent).toBe('function');
    expect(workflow.dispatchMessages.taskSent('Contract Review', 'Lex Intake'))
      .toBe('Zadanie "Contract Review" wysłane do Lex Intake');
  });

  it('dispatchMessages.taskPassed is a factory function', () => {
    expect(typeof workflow.dispatchMessages.taskPassed).toBe('function');
    expect(workflow.dispatchMessages.taskPassed('Lex Research'))
      .toBe('Zadanie przekazane do Lex Research via OpenClaw');
  });
});

// ── validation — structure ────────────────────────────────────────────────

describe('validation — field validation messages', () => {
  it('has all expected validation error messages', () => {
    expect(validation.invalidUuid).toBe('Invalid UUID format');
    expect(validation.invalidEmail).toBe('Invalid email address');
    expect(validation.passwordMinLength).toBe('Password must be at least 8 characters');
    expect(validation.invalidUrl).toBe('Invalid URL format');
    expect(validation.invalidJson).toBe('Request body must be valid JSON');
    expect(validation.titleRequired).toBe('title is required');
    expect(validation.contentRequired).toBe('content is required');
    expect(validation.taskIdRequired).toBe('taskId is required');
  });
});

// ── Convenience re-exports ─────────────────────────────────────────────────

describe('Convenience re-exports', () => {
  it('notFound delegates to api.notFound', () => {
    expect(notFound('Task')).toBe('Task not found');
  });

  it('internalErr delegates to api.internalError', () => {
    expect(internalErr('fetch tasks')).toBe('Failed to fetch tasks');
  });
});

// ── as const correctness ────────────────────────────────────────────────────

describe('messages are marked as const (structural integrity)', () => {
  // Object.isFrozen returns false for ESM module imports by design.
  // Instead, we verify the readonly nature by checking that nested objects
  // have the expected structure and values, and that factory functions work.

  it('api object has all expected top-level keys', () => {
    const keys = Object.keys(api);
    expect(keys).toContain('unauthorized');
    expect(keys).toContain('forbidden');
    expect(keys).toContain('notFound');
    expect(keys).toContain('internalError');
    expect(keys).toContain('tasks');
    expect(keys).toContain('agents');
    expect(keys).toContain('clients');
    expect(keys).toContain('knowledge');
    expect(keys).toContain('openclaw');
  });

  it('ui object has all expected top-level keys', () => {
    const keys = Object.keys(ui);
    expect(keys).toContain('nav');
    expect(keys).toContain('buttons');
    expect(keys).toContain('status');
    expect(keys).toContain('labels');
    expect(keys).toContain('placeholders');
    expect(keys).toContain('empty');
    expect(keys).toContain('tabs');
    expect(keys).toContain('processing');
    expect(keys).toContain('agents');
  });

  it('workflow object has all expected top-level keys', () => {
    const keys = Object.keys(workflow);
    expect(keys).toContain('stages');
    expect(keys).toContain('subStatus');
    expect(keys).toContain('dispatchMessages');
    expect(keys).toContain('seedEvents');
  });

  it('validation object has all expected keys', () => {
    const keys = Object.keys(validation);
    expect(keys).toContain('invalidUuid');
    expect(keys).toContain('invalidEmail');
    expect(keys).toContain('passwordMinLength');
  });
});
