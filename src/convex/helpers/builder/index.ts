// oxlint-disable typescript/no-explicit-any
import { AppError, appErrors } from '$convex/helpers/error';
import {
	flushMeetingRuntimeVersionBumps,
	resetScheduledMeetingRuntimeBumps,
} from '$convex/helpers/meetingRuntime';
import type { Triggers } from 'convex-helpers/server/triggers';
import { zodToConvex } from 'convex-helpers/server/zod4';
import {
	actionGeneric,
	type FunctionType,
	type FunctionVisibility,
	type GenericActionCtx,
	type GenericDataModel,
	type GenericMutationCtx,
	type GenericQueryCtx,
	internalActionGeneric,
	internalMutationGeneric,
	internalQueryGeneric,
	mutationGeneric,
	queryGeneric,
	type RegisteredAction,
	type RegisteredMutation,
	type RegisteredQuery,
} from 'convex/server';
import { z } from 'zod';
import type {
	AnyHandler,
	AnyMiddleware,
	Args,
	Context,
	Handler,
	InferredArgs,
	Middleware,
	ValidatorInput,
} from './types';

type Def<
	TDataModel extends GenericDataModel,
	TValidator extends ValidatorInput,
	TFuncType extends FunctionType | undefined,
> = {
	mws: AnyMiddleware[];
	functionType: TFuncType;
	validator: TValidator;
	triggers?: Triggers<TDataModel>;
};

class Builder<
	TDataModel extends GenericDataModel,
	TArgs extends Args,
	TValidator extends ValidatorInput,
	TContext extends Context,
> {
	#def: Def<TDataModel, TValidator, undefined>;

	constructor(def: Def<TDataModel, TValidator, undefined>) {
		this.#def = def;
	}

	input<TShape extends ValidatorInput>(shape: TShape) {
		return new Builder<
			TDataModel,
			z.infer<z.core.$ZodObject<TValidator & TShape, z.core.$strip>>,
			TValidator & TShape,
			TContext
		>({
			...this.#def,
			validator: {
				...this.#def.validator,
				...shape,
			},
		});
	}

	use<TCtxOut extends Context, TCtxIn extends Context>(
		middleware: Middleware<TArgs, TCtxIn & TContext, TCtxOut>,
	) {
		return new Builder<TDataModel, TArgs, TValidator, TCtxOut>({
			...this.#def,
			mws: [...this.#def.mws, middleware],
		});
	}

	query() {
		return new BuilderWithFuncType<
			TDataModel,
			'query',
			TArgs,
			TValidator,
			TContext & GenericQueryCtx<TDataModel>
		>({
			...this.#def,
			functionType: 'query',
		});
	}

	mutation() {
		return new BuilderWithFuncType<
			TDataModel,
			'mutation',
			TArgs,
			TValidator,
			TContext & GenericMutationCtx<TDataModel>
		>({
			...this.#def,
			functionType: 'mutation',
		});
	}

	action() {
		return new BuilderWithFuncType<
			TDataModel,
			'action',
			TArgs,
			TValidator,
			TContext & GenericActionCtx<TDataModel>
		>({
			...this.#def,
			functionType: 'action',
		});
	}

	$context<TCtx extends Context, TArg extends Args = Args>() {
		return {
			createMiddleware<TOutCtx extends Context>(
				middleware: Middleware<TArg & TArgs, TContext & TCtx, TOutCtx>,
			) {
				return middleware;
			},
		};
	}
}

class BuilderWithFuncType<
	TDataModel extends GenericDataModel,
	TFunctionType extends FunctionType,
	TArgs extends Args,
	TValidator extends ValidatorInput,
	TContext extends Context,
> {
	#def: Def<TDataModel, TValidator, TFunctionType>;

	constructor(def: Def<TDataModel, TValidator, TFunctionType>) {
		this.#def = def;
	}

	input<TShape extends ValidatorInput>(shape: TShape) {
		const def = {
			...this.#def,
			validator: {
				...this.#def.validator,
				...shape,
			},
		};

		return new BuilderWithFuncType<
			TDataModel,
			TFunctionType,
			z.infer<z.core.$ZodObject<TValidator & TShape, z.core.$strip>>,
			TValidator & TShape,
			TContext
		>(def);
	}

	use<TCtxIn extends Context, TCtxOut extends Context>(
		middleware: Middleware<TArgs, TContext & TCtxIn, TCtxOut>,
	) {
		return new BuilderWithFuncType<TDataModel, TFunctionType, TArgs, TValidator, TCtxOut>({
			...this.#def,
			mws: [...this.#def.mws, middleware],
		});
	}

	async #execute(handler: AnyHandler, mws: AnyMiddleware[], ctx: Context, args: unknown) {
		let handlerResult: unknown;

		const createNext = (idx: number) => {
			return async <C extends Context>(ctx: C) => {
				if (idx >= mws.length) {
					handlerResult = await handler({ ctx, args });
					return ctx;
				}

				const result = await mws[idx]({ ctx, args, next: createNext(idx + 1) });
				return result as C;
			};
		};

		await createNext(0)(ctx);

		return handlerResult;
	}

	#register<TReturn>(visibility: FunctionVisibility, handler: Handler<TContext, TArgs, TReturn>) {
		const { functionType, validator, mws, triggers } = this.#def;

		if (!functionType) {
			throw new Error('Function type not set. Call .query(), .mutation(), or .action() first.');
		}

		const zodValidator = z.object(validator);

		const composedHandler = async (
			ctx:
				| GenericQueryCtx<TDataModel>
				| GenericMutationCtx<TDataModel>
				| GenericActionCtx<TDataModel>,
			args: unknown,
		) => {
			const wrappedCtx =
				functionType === 'mutation' && triggers
					? triggers.wrapDB(ctx as GenericMutationCtx<TDataModel>)
					: ctx;

			const parsed = zodValidator.safeParse(args);

			AppError.assertZodSuccess(parsed, (e) => appErrors.zod_error(z.treeifyError(e)));

			try {
				const result = await this.#execute(handler, mws, wrappedCtx, parsed.data);

				if (functionType === 'mutation') {
					await flushMeetingRuntimeVersionBumps(wrappedCtx as GenericMutationCtx<TDataModel>);
				}

				return result;
			} finally {
				if (functionType === 'mutation') {
					resetScheduledMeetingRuntimeBumps();
				}
			}
		};

		const config = {
			args: zodToConvex(zodValidator),
			handler: composedHandler,
		};

		const isPublic = visibility === 'public';

		const registrationFn = {
			query: isPublic ? queryGeneric : internalQueryGeneric,
			mutation: isPublic ? mutationGeneric : internalMutationGeneric,
			action: isPublic ? actionGeneric : internalActionGeneric,
		}[functionType];

		return registrationFn(config);
	}

	public<TReturn>(
		handler: Handler<TContext, TArgs, TReturn>,
	): TFunctionType extends 'query'
		? RegisteredQuery<'public', InferredArgs<TValidator>, Promise<TReturn>>
		: TFunctionType extends 'mutation'
			? RegisteredMutation<'public', InferredArgs<TValidator>, Promise<TReturn>>
			: TFunctionType extends 'action'
				? RegisteredAction<'public', InferredArgs<TValidator>, Promise<TReturn>>
				: never {
		return this.#register('public', handler) as any;
	}

	internal<TReturn>(
		handler: Handler<TContext, TArgs, TReturn>,
	): TFunctionType extends 'query'
		? RegisteredQuery<'internal', InferredArgs<TValidator>, Promise<TReturn>>
		: TFunctionType extends 'mutation'
			? RegisteredMutation<'internal', InferredArgs<TValidator>, Promise<TReturn>>
			: TFunctionType extends 'action'
				? RegisteredAction<'internal', InferredArgs<TValidator>, Promise<TReturn>>
				: never {
		return this.#register('internal', handler) as any;
	}
}

export function createBuilder<TDataModel extends GenericDataModel>(
	triggers?: Triggers<TDataModel>,
) {
	return new Builder<TDataModel, {}, {}, GenericQueryCtx<TDataModel>>({
		mws: [],
		validator: {},
		functionType: undefined,
		triggers,
	});
}
