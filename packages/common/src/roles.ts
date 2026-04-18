export const ROLES = ['admin', 'moderator', 'participant', 'adjuster'] as const;
export type Role = (typeof ROLES)[number];
export function isValidRole(role: string): role is Role {
	return ROLES.includes(role as Role);
}

export const ROLE_LABELS: Record<Role, string> = {
	admin: 'Admin',
	moderator: 'Moderator',
	participant: 'Deltagare',
	adjuster: 'Justerare',
};

export const ROLE_HIERARCHY: Record<Role, Role[]> = {
	// `hasRole(userRole, atLeastRole)` checks whether `userRole` should be
	// allowed to perform actions requiring `atLeastRole`.
	admin: ['admin', 'moderator', 'participant', 'adjuster'],
	moderator: ['moderator', 'participant'],
	participant: ['participant'],
	adjuster: ['adjuster', 'participant'],
};

export function hasRole(role: Role, atLeastRole: Role) {
	return ROLE_HIERARCHY[role].includes(atLeastRole);
}
