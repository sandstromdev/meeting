import { z } from 'zod';

export const SignInSchema = z.object({
	email: z.email(),
	_password: z.string().nonempty(),
});

export const SignUpSchema = z.object({
	email: z.email(),
	_password: z.string().min(8),
	name: z.string().nonempty(),
});

export function validateRedirect(redirect?: string | null): redirect is string {
	return !!redirect && (redirect.startsWith('/anslut/') || redirect === '/m' || redirect === '/');
}
