import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WorkflowService } from '../services/workflow.service';
import { CreateWorkflowDto, UpdateWorkflowDto } from '../models/workflow.dto';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { TenantGuard } from '../../../guards/tenant.guard';

@ApiTags('Workflows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('workflows')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get()
  @ApiOperation({ summary: 'Get all automated workflows' })
  async GetAll() {
    return this.workflowService.GetAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workflow definition by ID' })
  async GetById(@Param('id', ParseUUIDPipe) id: string) {
    return this.workflowService.GetById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new automated workflow' })
  async Insert(@Body() dto: CreateWorkflowDto) {
    return this.workflowService.Insert(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update workflow definition' })
  async Update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.workflowService.Update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a workflow' })
  async Delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.workflowService.Delete(id);
  }
}
