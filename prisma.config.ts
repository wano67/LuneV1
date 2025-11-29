// prisma.config.ts
import { defineConfig, env } from 'prisma/config';
import 'dotenv/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  engine: 'classic',
  datasource: {
    // Ici Prisma attend une STRING, pas un objet
    url: env('DATABASE_URL'),
  },
});