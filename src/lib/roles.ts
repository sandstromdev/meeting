export const ROLES = ['admin', 'moderator', 'participant'] as const;
export type Role = (typeof ROLES)[number];
export function isValidRole(role: string): role is Role {
	return ROLES.includes(role as Role);
}

export const ROLE_LABELS: Record<Role, string> = {
	admin: 'Admin',
	moderator: 'Moderator',
	participant: 'Deltagare',
};
