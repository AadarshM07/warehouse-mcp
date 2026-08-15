import { Module } from '@nitrostack/core';
import { SharedResources } from './shared.resources.js';
import { SharedTools } from './shared.tools.js';

@Module({
  name: 'shared',
  controllers: [SharedResources, SharedTools],
  exports: [SharedResources, SharedTools]
})
export class SharedModule {}

