import { Injectable } from '@nitrostack/core';
import { DatabaseService } from '../database/database.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { SupplierService } from '../supplier/supplier.service.js';
import { PurchasingService } from '../purchasing/purchasing.service.js';
import { ObjectId } from 'mongodb';

export interface FormQuestion {
  field: string;
  prompt: string;
  type: 'string' | 'number' | 'email';
  required: boolean;
}

export interface FormSession {
  _id?: ObjectId;
  userId: string;
  formType: 'register_sku' | 'create_profile' | 'submit_proposal';
  currentStep: number;
  answers: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const FORM_QUESTIONS: Record<string, FormQuestion[]> = {
  register_sku: [
    { field: 'sku', prompt: 'Please enter the unique SKU code (e.g., SKU-100):', type: 'string', required: true },
    { field: 'description', prompt: 'Please enter a description for the SKU:', type: 'string', required: true },
    { field: 'reorderPoint', prompt: 'Enter the reorder point (minimum stock level, e.g., 10):', type: 'number', required: true },
    { field: 'reorderQuantity', prompt: 'Enter the reorder quantity (amount to order when triggered, e.g., 50):', type: 'number', required: true },
    { field: 'locations', prompt: 'Enter warehouse locations as a comma-separated list (e.g., WH-MAIN, WH-EAST):', type: 'string', required: true },
    { field: 'unitCost', prompt: 'Enter the unit cost (optional, or enter 0):', type: 'number', required: false },
  ],
  create_profile: [
    { field: 'companyName', prompt: 'Enter your supplier company name:', type: 'string', required: true },
    { field: 'contactEmail', prompt: 'Enter the primary contact email for your company:', type: 'email', required: true },
  ],
  submit_proposal: [
    { field: 'neededStockId', prompt: 'Enter the ID of the needed stock requirement:', type: 'string', required: true },
    { field: 'warehouseId', prompt: 'Enter the warehouse ID where you will supply the stock:', type: 'string', required: true },
    { field: 'bulkQuantity', prompt: 'Enter the bulk quantity you can supply:', type: 'number', required: true },
    { field: 'unitCost', prompt: 'Enter the unit cost per item:', type: 'number', required: true },
  ],
};

@Injectable({ deps: [DatabaseService, InventoryService, SupplierService, PurchasingService] })
export class FormService {
  constructor(
    private readonly db: DatabaseService,
    private readonly inventoryService: InventoryService,
    private readonly supplierService: SupplierService,
    private readonly purchasingService: PurchasingService
  ) {}

  private get sessions() {
    return this.db.getDb().collection<FormSession>('form_sessions');
  }

  async startForm(userId: string, role: string, formType: string) {
    if (!FORM_QUESTIONS[formType]) {
      throw new Error(`Invalid form type: ${formType}. Supported types: ${Object.keys(FORM_QUESTIONS).join(', ')}`);
    }

    if (formType === 'register_sku' && role !== 'manager' && role !== 'admin') {
      throw new Error('Unauthorized: Only warehouse managers can fill this form.');
    }

    if (['create_profile', 'submit_proposal'].includes(formType) && role !== 'supplier' && role !== 'admin') {
      throw new Error('Unauthorized: Only suppliers can fill this form.');
    }

    // Delete any active sessions for the user to start fresh
    await this.sessions.deleteMany({ userId, formType: formType as any });

    const session: FormSession = {
      userId,
      formType: formType as any,
      currentStep: 0,
      answers: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.sessions.insertOne(session);
    const questions = FORM_QUESTIONS[formType];

    return {
      sessionId: result.insertedId.toString(),
      formType,
      currentStep: 0,
      totalSteps: questions.length,
      nextQuestion: questions[0].prompt,
      field: questions[0].field,
      type: questions[0].type,
    };
  }

  async getQuestion(sessionId: string, direction: 'next' | 'previous' | 'current') {
    const session = await this.sessions.findOne({ _id: new ObjectId(sessionId) });
    if (!session) throw new Error('Form session not found.');

    const questions = FORM_QUESTIONS[session.formType];
    let step = session.currentStep;

    if (direction === 'next') {
      step = Math.min(step + 1, questions.length);
    } else if (direction === 'previous') {
      step = Math.max(step - 1, 0);
    }

    await this.sessions.updateOne(
      { _id: new ObjectId(sessionId) },
      { $set: { currentStep: step, updatedAt: new Date() } }
    );

    if (step >= questions.length) {
      return {
        sessionId,
        formType: session.formType,
        currentStep: step,
        totalSteps: questions.length,
        isCompleted: true,
        message: 'All fields have been filled. You can now submit the form.',
      };
    }

    const question = questions[step];
    return {
      sessionId,
      formType: session.formType,
      currentStep: step,
      totalSteps: questions.length,
      isCompleted: false,
      nextQuestion: question.prompt,
      field: question.field,
      type: question.type,
      currentValue: session.answers[question.field] ?? null,
    };
  }

  async saveAnswer(sessionId: string, answerValue: any) {
    const session = await this.sessions.findOne({ _id: new ObjectId(sessionId) });
    if (!session) throw new Error('Form session not found.');

    const questions = FORM_QUESTIONS[session.formType];
    if (session.currentStep >= questions.length) {
      throw new Error('All questions have already been answered. Please submit the form.');
    }

    const currentQuestion = questions[session.currentStep];

    // Validate and cast value
    let castValue = answerValue;
    if (currentQuestion.type === 'number') {
      castValue = Number(answerValue);
      if (isNaN(castValue)) {
        throw new Error(`Invalid value: Expected a number for field ${currentQuestion.field}`);
      }
    } else if (currentQuestion.type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(answerValue))) {
        throw new Error(`Invalid value: Expected a valid email address for field ${currentQuestion.field}`);
      }
    }

    // Save answer
    const newAnswers = { ...session.answers, [currentQuestion.field]: castValue };

    await this.sessions.updateOne(
      { _id: new ObjectId(sessionId) },
      { $set: { answers: newAnswers, updatedAt: new Date() } }
    );

    return {
      success: true,
      field: currentQuestion.field,
      value: castValue,
      message: `Answer saved for ${currentQuestion.field}.`,
    };
  }

  async submitForm(sessionId: string) {
    const session = await this.sessions.findOne({ _id: new ObjectId(sessionId) });
    if (!session) throw new Error('Form session not found.');

    const questions = FORM_QUESTIONS[session.formType];
    const missingFields: string[] = [];

    // Verify all required fields
    for (const q of questions) {
      if (q.required && (session.answers[q.field] === undefined || session.answers[q.field] === null)) {
        missingFields.push(q.field);
      }
    }

    if (missingFields.length > 0) {
      throw new Error(`Cannot submit form. The following required fields are missing answers: ${missingFields.join(', ')}`);
    }

    let result;
    const { answers, userId, formType } = session;

    if (formType === 'register_sku') {
      const locations = String(answers.locations)
        .split(',')
        .map(l => l.trim())
        .filter(l => l.length > 0);

      result = await this.inventoryService.registerSku({
        sku: answers.sku,
        description: answers.description,
        reorderPoint: answers.reorderPoint,
        reorderQuantity: answers.reorderQuantity,
        unitCost: answers.unitCost ? Number(answers.unitCost) : undefined,
        locations,
      });

    } else if (formType === 'create_profile') {
      result = await this.supplierService.createProfile(userId, answers.companyName, answers.contactEmail);
    } else if (formType === 'submit_proposal') {
      result = await this.supplierService.submitProposal(
        userId,
        answers.neededStockId,
        answers.warehouseId,
        Number(answers.bulkQuantity),
        Number(answers.unitCost)
      );
    }

    // Delete session on successful submission
    await this.sessions.deleteOne({ _id: new ObjectId(sessionId) });

    return {
      success: true,
      formType,
      message: 'Form successfully submitted and processed.',
      result,
    };
  }
}
