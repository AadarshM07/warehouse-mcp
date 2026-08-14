import { Module } from '@nitrostack/core';
import { ReportingService } from './reporting.service.js';
import { ReportingTools } from './reporting.tools.js';
import { DatabaseModule } from '../database/database.module.js';

@Module({
  name: 'reporting',
  imports: [DatabaseModule],
  providers: [ReportingService],
  controllers: [ReportingTools],
  exports: [ReportingService],
})
export class ReportingModule {}
