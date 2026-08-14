import { Guard, ExecutionContext, Injectable } from '@nitrostack/core';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

@Injectable()
export class OAuthGuard implements Guard {
  private jwksClient?: jwksClient.JwksClient;

  constructor() {
    const authServerUrl = process.env.AUTH_SERVER_URL;
    if (authServerUrl) {
      this.jwksClient = jwksClient({
        jwksUri: `${authServerUrl}/.well-known/jwks.json`
      });
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const token = this.extractToken(context);

    if (!token) {
      console.error('OAuthGuard: No token found');
      throw new Error('Authentication required: Token is missing.');
    }

    if (!this.jwksClient) {
      console.error('OAuthGuard: Auth server url not configured');
      throw new Error('Authentication required: Auth server configuration is missing.');
    }

    try {
      const decoded = await this.verifyToken(token) as any;
      
      (context as any).auth = {
        subject: decoded.sub,
        role: this.extractRole(decoded),
        token,
      };
      
      return true;
    } catch (err) {
      console.error('OAuthGuard: Token verification failed', err);
      throw new Error('Authentication required: Token is invalid or expired.');
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

  private verifyToken(token: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const getKey = (header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) => {
        if (!this.jwksClient) {
          return callback(new Error('JWKS client is not initialized'));
        }
        this.jwksClient.getSigningKey(header.kid, (err, key) => {
          if (err || !key) {
            return callback(err || new Error('No key found'));
          }
          const signingKey = key.getPublicKey();
          callback(null, signingKey);
        });
      };

      const options = {
        audience: process.env.AUDIENCE,
        issuer: process.env.AUTH_SERVER_URL ? `${process.env.AUTH_SERVER_URL}/` : undefined,
        algorithms: ['RS256'] as jwt.Algorithm[],
      };

      jwt.verify(token, getKey, options, (err: any, decoded: any) => {
        if (err) return reject(err);
        resolve(decoded);
      });
    });
  }
}
