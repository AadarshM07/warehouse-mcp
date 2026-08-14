import { Guard, ExecutionContext, Injectable } from '@nitrostack/core';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

@Injectable()
export class OAuthGuard implements Guard {
  private jwksClient: jwksClient.JwksClient;

  constructor() {
    const authServerUrl = process.env.AUTH_SERVER_URL;
    
    this.jwksClient = jwksClient({
      jwksUri: `${authServerUrl}/.well-known/jwks.json`
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const token = this.extractToken(context);
    
    const generateLoginLink = () => {
      const authUrl = process.env.AUTH_SERVER_URL;
      const clientId = process.env.CLIENT_ID;
      const audience = process.env.AUDIENCE;
      const redirectUri = process.env.REDIRECT_URI || 'http://localhost:3000/callback';
      
      if (!authUrl || !clientId) return null;
      return `${authUrl}/authorize?response_type=code&client_id=${clientId}&audience=${audience}&redirect_uri=${redirectUri}&scope=openid profile email`;
    };

    if (!token) {
      console.error('OAuthGuard: No token found');
      const loginLink = generateLoginLink();
      if (loginLink) {
        throw new Error(`You are not authenticated. Please log in by clicking this link: ${loginLink}`);
      }
      throw new Error('You are not authenticated. (Auth server configuration missing)');
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
      const loginLink = generateLoginLink();
      if (loginLink) {
        throw new Error(`Your session is invalid or expired. Please log in again: ${loginLink}`);
      }
      throw new Error('Your session is invalid or expired. Please log in again.');
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
