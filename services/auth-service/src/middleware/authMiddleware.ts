import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface JwtPayload {
  userId: string;
  tenantId: string;
  role: 'ADMIN' | 'USER' | 'AGENT' | 'AUDITOR';
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    (req as any).user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Weak role middleware — only checks if role matches, no hierarchy
// AGENT and AUDITOR roles not implemented — returns 403 always
export const requireRole = (role: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }
    // TODO: Implement proper RBAC hierarchy (ADMIN > USER > AGENT > AUDITOR)
    if (user.role !== role && user.role !== 'ADMIN') {
      res.status(403).json({ error: `Requires role: ${role}` });
      return;
    }
    next();
  };
};
