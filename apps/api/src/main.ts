import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import { parseTrustProxySetting, TRUST_PROXY_ENV } from './common/trust-proxy-setting';

type CorsCallback = (err: Error | null, allow?: boolean) => void;

const frontendOrigins = [
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
];

function getAllowedOrigins() {
  return [
    ...frontendOrigins,
    ...(process.env.CORS_ORIGIN ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  ];
}

async function bootstrap() {
  // Parsed before the app starts so a missing or invalid value fails the boot with a clear message.
  const trustProxy = parseTrustProxySetting(process.env[TRUST_PROXY_ENV]);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', trustProxy);

  // Worker `onApplicationShutdown` hooks and Prisma disconnect run on SIGTERM/SIGINT.
  app.enableShutdownHooks();

  // Portals on other localhost ports are same-site, so they can still load API
  // responses; cross-site embedding stays blocked.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));

  app.setGlobalPrefix('api', {
    exclude: ['health'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());

  app.enableCors({
    origin: (origin: string | undefined, callback: CorsCallback) => {
      const allowedOrigins = getAllowedOrigins();

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  console.log(`p.r.i.s.m api listening on port ${port}`);
}

bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
