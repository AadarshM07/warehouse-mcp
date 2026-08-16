import { Guard, ExecutionContext, Injectable, OAuthModule } from '@nitrostack/core';
import jwt from 'jsonwebtoken';

@Injectable()
export class OAuthGuard implements Guard {
  constructor() {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isOAuthRequired = process.env.OAUTH_REQUIRED === 'true';
    const token = this.extractToken(context);

    if (!isOAuthRequired) {
      (context as any).auth = {
        subject: 'dev-bypass-user',
        role: process.env.BYPASS_ROLE || 'admin',
        token: token || 'dev-bypass-token',
      };
      return true;
    }

    if (!token) {
      console.error('OAuthGuard: No token found');
      throw new Error('Authentication required: Token is missing.');
    }

    try {
      const result = await OAuthModule.validateToken(token);
      if (!result.valid || !result.payload) {
        console.error('OAuthGuard: Token validation failed:', result.error);
        throw new Error(`Authentication required: ${result.error || 'Token is invalid or expired.'}`);
      }

      // Token is cryptographically verified by OAuthModule. Let's decode it to extract custom claims like role
      const decoded = jwt.decode(token) as any;
      if (!decoded) {
        throw new Error('Authentication required: Token format is invalid.');
      }
      
      (context as any).auth = {
        subject: decoded.sub,
        role: this.extractRole(decoded),
        token,
      };
      
      return true;
    } catch (err: any) {
      console.error('OAuthGuard: Token verification failed', err);
      throw new Error(err.message || 'Authentication required: Token is invalid or expired.');
    }
  }

  private extractRole(decoded: any): string | null {
    const audience = process.env.AUDIENCE ;
    const customRoleKey = `${audience}/roles`;
    
    const roles = decoded[customRoleKey] || decoded.roles || decoded.role;
    
    if (Array.isArray(roles)) {
        return roles[0] || null; 
    }
    return typeof roles === 'string' ? roles : null;
  }

  private extractToken(context: ExecutionContext): string | null {
    const auth = context.metadata?.authorization;
    if (auth && typeof auth === 'string' && auth.startsWith('Bearer ')) {
      return auth.substring(7);
    }
    return null;
  }
}

