import { form, getRequestEvent } from '$app/server';
import { authClient } from '$lib/auth-client';
import { ErrorMessages } from '$lib/errors';
import { invalid } from '@sveltejs/kit';
import { SignInSchema, SignUpSchema } from './schema';

export const signIn = form(SignInSchema, async ({ email, _password }) => {
	const event = getRequestEvent();

	const { error } = await authClient.signIn.email({
		email,
		password: _password,
		fetchOptions: { customFetchImpl: event.fetch },
	});

	if (error?.code === 'INVALID_EMAIL_OR_PASSWORD') {
		invalid(ErrorMessages.invalid_credentials());
	} else if (error) {
		console.error(error);
	}

	return { success: true };
});

export const signUp = form(SignUpSchema, async ({ email, _password, name }) => {
	const event = getRequestEvent();

	console.log({
		name,
		email,
		_password,
	});

	try {
		const { data, error } = await authClient.signUp.email({
			name,
			email,
			password: _password,
			fetchOptions: { customFetchImpl: event.fetch },
		});

		console.log({ data, error });

		if (error) {
			if (error.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
				invalid(ErrorMessages.email_exists());
			}

			console.error(error);
			invalid(ErrorMessages.internal_error());
		}
	} catch (e) {
		console.error(e);
		invalid(ErrorMessages.internal_error());
	}

	return { success: true };
});
