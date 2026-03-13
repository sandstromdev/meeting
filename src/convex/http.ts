import { httpRouter } from 'convex/server';
import { authComponent, createAuth } from './auth';
import { httpAction } from './_generated/server';

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

http.route({
	path: '/api/test',
	method: 'GET',
	handler: httpAction(async (ctx, req) => {
		console.log({
			ctx,
			req: {
				headers: req.headers,
				body: await req.text(),
				url: req.url,
			},
		});

		return new Response('pong');
	}),
});

export default http;
