import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { randomUUID } from 'crypto';
import { tenantAls } from './tenant-context';
import { AuthUser } from './decorators';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      user?: AuthUser;
      headers: Record<string, string | string[] | undefined>;
      correlationId?: string;
    }>();

    const headerValue = request.headers['x-correlation-id'];
    const correlationId =
      (Array.isArray(headerValue) ? headerValue[0] : headerValue) ||
      randomUUID();
    request.correlationId = correlationId;

    const user = request.user;
    const store = {
      tenantId: user?.audience === 'tenant' ? (user.tenantId ?? null) : null,
      bypassRls: user?.audience === 'platform',
    };

    return new Observable((subscriber) => {
      tenantAls.run(store, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
