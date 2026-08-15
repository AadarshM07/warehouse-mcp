import { ControllerDecorator as Controller, ToolDecorator as Tool, Injectable, z, UseGuards, ExecutionContext } from '@nitrostack/core';
import { OAuthGuard } from '../../guards/oauth.guard.js';

@Controller('shared')
@Injectable()
export class SharedTools {
  @UseGuards(OAuthGuard)
  @Tool({
    name: 'get_current_user',
    description: 'Retrieves details about the currently authenticated user (role, subject ID, and capability resource link).',
    inputSchema: z.object({}),
  })
  async getCurrentUser(input: {}, context: ExecutionContext) {
    const auth = (context as any).auth;
    if (!auth) {
      throw new Error('Unauthenticated user.');
    }
    return {
      userId: auth.subject,
      role: auth.role,
      capabilitiesResourceUri: `app://shared/capabilities/${auth.role}`
    };
  }
}
