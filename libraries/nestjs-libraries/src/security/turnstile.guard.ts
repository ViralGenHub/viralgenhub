import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { getClientIp } from '@gitroom/nestjs-libraries/throttler/throttler.provider';
import {
  TURNSTILE_HEADER,
  verifyTurnstile,
} from '@gitroom/nestjs-libraries/security/turnstile';

// Used on POST /auth/register and POST /auth/login only.
// Social sign-in (Google, Apple, GitHub, Farcaster ...) sends a provider
// other than LOCAL: the provider has already verified that person, so the
// check is skipped for those. OAuth callbacks are different routes and are
// not guarded.
@Injectable()
export class TurnstileGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const provider = String(req.body?.provider || 'LOCAL').toUpperCase();
    if (provider !== 'LOCAL') {
      return true;
    }

    const result = await verifyTurnstile(
      req.headers?.[TURNSTILE_HEADER],
      getClientIp(req)
    );
    if (!result.ok) {
      throw new HttpException(result.message, 400);
    }

    return true;
  }
}
