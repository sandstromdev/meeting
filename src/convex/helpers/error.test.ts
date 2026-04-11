import { ConvexError } from 'convex/values';
import { describe, expect, it } from 'vitest';
import * as z from 'zod';

import { AppError, appErrors, err, getAppError, isAppError, isAppErrorCode, ok } from './error';

describe('AppError', () => {
	it('exposes code, status, message, and is()', () => {
		const e = new AppError('forbidden', 403);
		expect(e.code).toBe('forbidden');
		expect(e.status).toBe(403);
		expect(e.message.length).toBeGreaterThan(0);
		expect(e.is('forbidden')).toBe(true);
		expect(e.is('unauthorized')).toBe(false);
	});

	it('serializes and round-trips via toJSON / fromJSON', () => {
		const original = appErrors.bad_request({ foo: 'bar' });
		const restored = AppError.fromJSON(original.toJSON());
		expect(restored.code).toBe('bad_request');
		expect(restored.status).toBe(400);
		expect(restored.toJSON()).toEqual(original.toJSON());
	});

	it('fromJSON rejects invalid payloads', () => {
		expect(() => AppError.fromJSON({})).toThrow('Invalid app error JSON');
	});

	it('assert throws the given error when predicate is false', () => {
		expect(() => AppError.assert(false, appErrors.unauthorized())).toThrow(ConvexError);
	});

	it('assertZodSuccess throws on failed parse', () => {
		const result = z.string().safeParse(123);
		expect(() => AppError.assertZodSuccess(result)).toThrow(ConvexError);
	});

	it('factory helpers ok/err match AppResult shape', () => {
		expect(ok(42)).toEqual({ ok: true, data: 42 });
		const e = appErrors.meeting_not_found({ meetingCode: '000000' });
		expect(err(e)).toEqual({ ok: false, error: e });
	});

	it('isAppError narrows ConvexError app_error data', () => {
		const e = appErrors.forbidden();
		expect(isAppError(e)).toBe(true);
		expect(isAppError(e, 'forbidden')).toBe(true);
		expect(isAppError(e, 'unauthorized')).toBe(false);
		expect(isAppError(new Error('x'))).toBe(false);
		expect(isAppError(new ConvexError({ type: 'other' }))).toBe(false);
	});

	it('getAppError returns null for non-app errors', () => {
		expect(getAppError(new Error('x'))).toBe(null);
		expect(getAppError(appErrors.internal_error())?.code).toBe('internal_error');
	});

	it('isAppErrorCode validates known codes', () => {
		expect(isAppErrorCode('forbidden')).toBe(true);
		expect(isAppErrorCode('not_a_real_code')).toBe(false);
	});
});
