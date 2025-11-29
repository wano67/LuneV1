// src/api/plugins/auth.ts
import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// Ce qu'on met dans le token
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string };
    user: { id: string };
  }
}

// Ce qu'on veut sur request.user ET sur app.authenticate
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    user: {
      id: string;
    };
  }
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
  });

  app.decorate(
    'authenticate',
    async function authenticate(this: FastifyInstance, request: FastifyRequest, reply: FastifyReply) {
      const payload = await request.jwtVerify<{ sub: string }>();
      request.user = { id: payload.sub };
    },
  );
});
