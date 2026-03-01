import { form, getRequestEvent } from '$app/server';
import { authClient } from '$lib/auth-client';
import { invalid, redirect } from '@sveltejs/kit';
import { SignInSchema, SignUpSchema } from './schema';
import { ErrorMessages } from '$lib/errors';

export const signIn = form(SignInSchema, async ({ email, _password }) => {
	const event = getRequestEvent();

	const { error } = await authClient.signIn.email({
		email,
		password: _password,
		fetchOptions: { customFetchImpl: event.fetch },
		callbackURL: '/',
	});

	if (error?.code === 'INVALID_EMAIL_OR_PASSWORD') {
		invalid(ErrorMessages.invalid_credentials());
	} else if (error) {
		console.error(error);
	}

	redirect(303, '/anslut');
});

export const signUp = form(SignUpSchema, async ({ email, _password, name }) => {
	const event = getRequestEvent();

	const { error } = await authClient.signUp.email({
		name,
		email,
		password: _password,
		fetchOptions: { customFetchImpl: event.fetch },
	});

	if (error) {
		if (error.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
			invalid(ErrorMessages.email_exists());
		}

		console.error(error);
		invalid(ErrorMessages.internal_error());
	}

	redirect(303, '/anslut');
});
