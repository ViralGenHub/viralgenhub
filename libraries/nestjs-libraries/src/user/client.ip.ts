import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { getClientIp } from '@gitroom/nestjs-libraries/throttler/throttler.provider';

// The address of the person making the request, for anything we STORE or
// compare (sign-up ip, audit lines, tracking). Replaces @RealIP()
// (nestjs-real-ip), which records the Cloudflare edge address when the app
// sits behind Cloudflare (#507). getClientIp honours CF-Connecting-IP only
// when TRUST_CF_CONNECTING_IP is set; otherwise it is req.ip.
export const clientIpFromContext = (
  _data: unknown,
  ctx: ExecutionContext
): string => getClientIp(ctx.switchToHttp().getRequest());

export const ClientIp = createParamDecorator(clientIpFromContext);
