import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    _startTime?: number;
  }
}

export async function loggingPlugin(app: FastifyInstance) {
  app.addHook('onRequest', async (request: FastifyRequest) => {
    request._startTime = Date.now();

    app.log.info({
      msg: 'incoming_request',
      method: request.method,
      url: request.url,
      route: request.routeOptions.url, // <— Safe & typed
      userId: (request as any).user?.id?.toString(),
    });
  });

  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const durationMs =
      typeof request._startTime === 'number' ? Date.now() - request._startTime : undefined;

    app.log.info({
      msg: 'request_completed',
      method: request.method,
      url: request.url,
      route: request.routeOptions.url, // <— Same here
      statusCode: reply.statusCode,
      userId: (request as any).user?.id?.toString(),
      durationMs,
    });
  });
}