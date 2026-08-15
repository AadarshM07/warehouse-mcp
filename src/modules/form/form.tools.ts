import { ControllerDecorator as Controller, ToolDecorator as Tool, Injectable, z, UseGuards, ExecutionContext } from '@nitrostack/core';
import { OAuthGuard } from '../../guards/oauth.guard.js';
import { FormService } from './form.service.js';

@Controller('form')
@Injectable({ deps: [FormService] })
export class FormTools {
  constructor(private readonly formService: FormService) {}

  @UseGuards(OAuthGuard)
  @Tool({
    name: 'start_form_session',
    description: 'Starts a new stateful form session for multi-field input (e.g. register_sku, create_profile, submit_proposal). Returns the first question.',
    inputSchema: z.object({
      formType: z.enum(['register_sku', 'create_profile', 'submit_proposal']).describe('The type of form to fill'),
    }),
  })
  async startFormSession(input: { formType: string }, context: ExecutionContext) {
    const userId = (context as any).auth?.subject;
    const role = (context as any).auth?.role || 'unknown';
    if (!userId) throw new Error('Unauthenticated user.');
    return this.formService.startForm(userId, role, input.formType);
  }

  @UseGuards(OAuthGuard)
  @Tool({
    name: 'get_next_question',
    description: 'Retrieves the next question in the active form session.',
    inputSchema: z.object({
      sessionId: z.string().describe('The active form session ID'),
    }),
  })
  async getNextQuestion(input: { sessionId: string }) {
    return this.formService.getQuestion(input.sessionId, 'next');
  }

  @UseGuards(OAuthGuard)
  @Tool({
    name: 'get_previous_question',
    description: 'Retrieves the previous question in the active form session.',
    inputSchema: z.object({
      sessionId: z.string().describe('The active form session ID'),
    }),
  })
  async getPreviousQuestion(input: { sessionId: string }) {
    return this.formService.getQuestion(input.sessionId, 'previous');
  }

  @UseGuards(OAuthGuard)
  @Tool({
    name: 'save_answer',
    description: 'Saves the answer for the current question in the form session.',
    inputSchema: z.object({
      sessionId: z.string().describe('The active form session ID'),
      answer: z.any().describe('The answer value to save'),
    }),
  })
  async saveAnswer(input: { sessionId: string; answer: any }) {
    return this.formService.saveAnswer(input.sessionId, input.answer);
  }

  @UseGuards(OAuthGuard)
  @Tool({
    name: 'submit_form',
    description: 'Submits the filled form session, executing the underlying action and closing the session.',
    inputSchema: z.object({
      sessionId: z.string().describe('The active form session ID'),
    }),
  })
  async submitForm(input: { sessionId: string }) {
    return this.formService.submitForm(input.sessionId);
  }
}
