import { form, getRequestEvent } from '$app/server';
import { authClient } from '$lib/auth-client';
import { ErrorMessages } from '$lib/errors';
import { invalid } from '@sveltejs/kit';
import { SignInSchema, SignUpSchema } from './schema';

export const signIn = form(SignInSchema, async ({ email, _password }) => {
	const { error } = await authClient.signIn.email({
		email,
		password: _password,
		fetchOptions: {
			customFetchImpl: getRequestEvent().fetch,
		},
	});

	if (error?.code === 'INVALID_EMAIL_OR_PASSWORD') {
		invalid(ErrorMessages.invalid_credentials());
	} else if (error) {
		console.error('error:', error);
	}

	return { success: true };
});

export const signUp = form(SignUpSchema, async ({ name, email, _password }, issue) => {
	const { error } = await authClient.signUp.email({
		name,
		email,
		password: _password,
		fetchOptions: {
			customFetchImpl: getRequestEvent().fetch,
		},
	});

	if (error) {
		if (error.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
			invalid(issue.email(ErrorMessages.email_exists()));
		}

		console.error(error);
		invalid(ErrorMessages.internal_error());
	}

	return { success: true };
});
