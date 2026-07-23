import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthUser } from '../../common/decorators';

type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  aud: 'platform' | 'tenant';
  tenantId?: string;
  tenantSlug?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('app.jwt.accessSecret');
    if (!secret) {
      throw new Error('JWT access secret is not configured');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload): AuthUser {
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      audience: payload.aud,
      tenantId: payload.tenantId,
    };
  }
}
