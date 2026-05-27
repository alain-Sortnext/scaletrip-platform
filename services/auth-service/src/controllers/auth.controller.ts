import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { UserRepository } from '../repository/UserRepository';
import { logger } from '../middleware/logger';

const userRepo = new UserRepository();

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    const user = await userRepo.findByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenant_id,
        role: user.role,
        // TODO: Add 'iat' and 'jti' claims for audit trail (SCLT-004)
      },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRY || '15m' }
    );

    // TODO: Implement refresh token flow (SCLT-004)
    // - Issue refresh token (7 day expiry, stored in DB)
    // - Add POST /auth/refresh endpoint
    // - Add POST /auth/revoke endpoint
    // Without this, users get logged out every 15 minutes silently

    logger.info('User logged in', { userId: user.id, tenantId: user.tenant_id });

    res.json({
      access_token: token,
      token_type: 'Bearer',
      expires_in: 900,
      // refresh_token: null,  // NOT IMPLEMENTED (SCLT-004)
    });
  }

  async me(req: Request, res: Response): Promise<void> {
    // req.user is set by authMiddleware
    res.json({ data: (req as any).user });
  }

  // TODO: Implement this endpoint (SCLT-004)
  async refresh(req: Request, res: Response): Promise<void> {
    res.status(501).json({ error: 'Refresh token flow not implemented yet' });
  }
}
