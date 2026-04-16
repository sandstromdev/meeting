import { form } from '$app/server';
import { SignInSchema, SignUpSchema } from './schema';

export const signIn = form(SignInSchema, async () => {
	return { success: true };
});

export const signUp = form(SignUpSchema, async () => {
	return { success: true };
});
