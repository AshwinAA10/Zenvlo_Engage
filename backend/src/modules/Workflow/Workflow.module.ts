import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowDefinition } from './entities/workflow-definition.entity';
import { WorkflowExecution } from './entities/workflow-execution.entity';
import { Trigger } from './entities/trigger.entity';
import { Action } from './entities/action.entity';
import { WorkflowService } from './services/workflow.service';
import { WorkflowController } from './controllers/workflow.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowDefinition,
      WorkflowExecution,
      Trigger,
      Action,
    ]),
  ],
  controllers: [WorkflowController],
  providers: [WorkflowService],
  exports: [WorkflowService, TypeOrmModule],
})
export class WorkflowModule {}
