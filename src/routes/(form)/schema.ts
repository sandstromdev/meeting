import { z } from 'zod';

export const SignInSchema = z.object({
	email: z.email(),
	_password: z.string().nonempty()
});

export const SignUpSchema = z.object({
	email: z.email(),
	_password: z.string().min(8),
	name: z.string().nonempty()
});
