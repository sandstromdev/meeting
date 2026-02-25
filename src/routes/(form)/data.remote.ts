import { form, getRequestEvent } from '$app/server';
import { authClient } from '$lib/auth-client';
import { invalid, redirect } from '@sveltejs/kit';
import { SignInSchema, SignUpSchema } from './schema';

export const signIn = form(SignInSchema, async ({ email, _password }) => {
	const event = getRequestEvent();

	const { error } = await authClient.signIn.email({
		email,
		password: _password,
		fetchOptions: { customFetchImpl: event.fetch },
		callbackURL: '/'
	});

	if (error?.code === 'INVALID_EMAIL_OR_PASSWORD') {
		invalid('Ogiltig e-post eller lösenord');
	} else if (error) {
		console.error(error);
	}

	return { redirect: '/anslut' };
});

export const signUp = form(SignUpSchema, async ({ email, _password, name }) => {
	const event = getRequestEvent();

	const { error } = await authClient.signUp.email({
		name,
		email,
		password: _password,
		fetchOptions: { customFetchImpl: event.fetch }
	});

	if (error) {
		console.error(error);
		invalid('Internal error');
	}

	return { redirect: '/anslut' };
});
