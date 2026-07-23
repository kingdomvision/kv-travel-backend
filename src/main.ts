import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { JwtAuthGuard, RolesGuard } from './modules/identity/guards';
import { TenantContextInterceptor } from './common/tenant-context.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = app.get(Logger);
  app.useLogger(logger);

  app.use(helmet());
  app.use(cookieParser());

  const prefix = config.get<string>('app.apiPrefix') ?? 'api/v1';
  app.setGlobalPrefix(prefix);
  app.enableCors({
    origin: config.get<string[]>('app.corsOrigins'),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector), new RolesGuard(reflector));
  app.useGlobalInterceptors(new TenantContextInterceptor());

  const nodeEnv = config.get<string>('app.nodeEnv') ?? 'development';
  if (nodeEnv === 'production') {
    const cookieSecure = config.get<boolean>('app.cookie.secure');
    if (!cookieSecure) {
      logger.warn(
        'COOKIE_SECURE is false in production. Refresh tokens will be sent over plaintext HTTP.',
      );
    }
  }
  if (nodeEnv !== 'production') {
    const swagger = new DocumentBuilder()
      .setTitle('KV Travel API')
      .setDescription('Platform admin and tenant APIs')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));
  }

  const port = config.get<number>('app.port') ?? 3000;
  await app.listen(port);
  logger.log(`API listening on http://localhost:${port}/${prefix}`);
  if (nodeEnv !== 'production') {
    logger.log(`Swagger at http://localhost:${port}/docs`);
  }
}

bootstrap();
