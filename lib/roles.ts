// Single source of truth for church-membership roles.
// Imported by both client (team page) and server (API routes).

export const ROLES = [
  { value: 'member', label: 'Member', color: 'rgba(255,255,255,0.40)' },
  { value: 'pastor', label: 'Pastor', color: '#34d399' },
  { value: 'admin',  label: 'Admin',  color: '#818cf8' },
  { value: 'master', label: 'Master', color: '#f59e0b' },
] as const

export type Role = (typeof ROLES)[number]['value']

export const VALID_ROLES: readonly Role[] = ROLES.map(r => r.value)

export const VALID_STATUSES = ['approved', 'pending', 'rejected'] as const
export type MembershipStatus = (typeof VALID_STATUSES)[number]

/** Roles allowed to administer a church (read members, rotate access key, change roles). */
export const ADMIN_ROLES: readonly Role[] = ['admin', 'pastor', 'master']

export function isAdminRole(role: string | null | undefined): role is Role {
  return !!role && (ADMIN_ROLES as readonly string[]).includes(role)
}

export function isMasterRole(role: string | null | undefined): boolean {
  return role === 'master'
}

export function roleLabel(role: string): string {
  return ROLES.find(r => r.value === role)?.label ?? role
}

export function roleColor(role: string): string {
  return ROLES.find(r => r.value === role)?.color ?? 'rgba(255,255,255,0.40)'
}
