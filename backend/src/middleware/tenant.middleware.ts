import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { UnauthorizedError, NotFoundError } from '../utils/errors';

declare global {
  namespace Express {
    interface Request {
      tenantId: string;
    }
  }
}

export async function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const tenantId = req.headers['x-tenant-id'] as string;

  if (!tenantId || tenantId.trim() === '') {
    next(new UnauthorizedError('x-tenant-id header is required'));
    return;
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

  if (!tenant) {
    logger.warn({ tenantId }, 'Unknown tenant attempted access');
    next(new UnauthorizedError(`Unknown tenant: ${tenantId}`));
    return;
  }

  req.tenantId = tenant.id;
  logger.debug({ tenantId: tenant.id }, 'Tenant authenticated');
  next();
}
