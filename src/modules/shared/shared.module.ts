import { Module } from '@nitrostack/core';
import { SharedResources } from './shared.resources.js';
import { SharedPrompts } from './shared.prompts.js';

@Module({
  name: 'shared',
  controllers: [SharedResources, SharedPrompts],
  exports: [SharedResources, SharedPrompts]
})
export class SharedModule {}
