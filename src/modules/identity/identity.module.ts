import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PlatformUser } from './entities/platform-user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuditLog } from './entities/audit-log.entity';
import { TenantUser } from '../tenancy/entities/tenant-user.entity';
import { Tenant } from '../tenancy/entities/tenant.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { AuditService } from './audit.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('app.jwt.accessSecret'),
      }),
    }),
    TypeOrmModule.forFeature([
      PlatformUser,
      RefreshToken,
      AuditLog,
      TenantUser,
      Tenant,
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, AuditService],
  exports: [AuthService, AuditService, JwtModule, TypeOrmModule],
})
export class IdentityModule {}
