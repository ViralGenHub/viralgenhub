import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { isDisposableEmail } from '@gitroom/nestjs-libraries/security/disposable-email';

export const DISPOSABLE_EMAIL_MESSAGE =
  'Please use a permanent email address. Temporary email services are not accepted.';

// POST /auth/register only, and only for email (LOCAL) sign-ups: social
// sign-in is verified by the provider.
@Injectable()
export class DisposableEmailGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const body = context.switchToHttp().getRequest().body;
    const provider = String(body?.provider || 'LOCAL').toUpperCase();
    if (provider === 'LOCAL' && isDisposableEmail(body?.email)) {
      throw new HttpException(DISPOSABLE_EMAIL_MESSAGE, 400);
    }

    return true;
  }
}
