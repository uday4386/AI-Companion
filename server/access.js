import { q, getSetting } from './db.js';

/**
 * Record-level access control for errors.
 * Admin: everything. Member: depends on the admin-configured visibility policy
 * (`team_visibility` setting): 'own_or_assigned' (default) or 'team_wide'.
 * This mirrors the main product decision documented in the project guide.
 */
export function memberVisibilitySql(user) {
  if (user.role === 'admin') return { clause: '1=1', params: [] };
  if (getSetting('team_visibility') === 'team_wide') return { clause: '1=1', params: [] };
  return { clause: '(e.submitted_by = ? OR e.assigned_to = ?)', params: [user.id, user.id] };
}

export function canViewError(user, errorRow) {
  if (!user || !errorRow) return false;
  if (user.role === 'admin') return true;
  if (getSetting('team_visibility') === 'team_wide') return true;
  return errorRow.submitted_by === user.id || errorRow.assigned_to === user.id;
}

export function canAssign(user) {
  return user?.role === 'admin';
}

export function canChangeStatus(user) {
  return user?.role === 'admin';
}

export function canManageUsers(user) {
  return user?.role === 'admin';
}

export function canViewAdminNotes(user) {
  return user?.role === 'admin';
}

export function visibilityLabel() {
  return getSetting('team_visibility') === 'team_wide'
    ? 'All team members can view every error'
    : 'Members see errors they submitted or are assigned to';
}

export function assertVisible(user, errorRow, res, { hideStatus = 404 } = {}) {
  if (!errorRow) {
    res.status(404).json({ error: 'Error record not found.', code: 'NOT_FOUND' });
    return false;
  }
  if (!canViewError(user, errorRow)) {
    res.status(hideStatus).json({
      error: hideStatus === 404 ? 'Error record not found.' : 'You do not have access to this record.',
      code: 'NOT_FOUND',
    });
    return false;
  }
  return true;
}

export function isAssignee(user, errorRow) {
  return Boolean(user && errorRow && errorRow.assigned_to === user.id);
}

export function activeUsers() {
  return q.all("SELECT * FROM profiles WHERE account_status = 'active' ORDER BY full_name");
}
