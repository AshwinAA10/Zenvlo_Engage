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
import { TenantService } from '../services/tenant.service';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from '../models/tenant.dto';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active workspaces' })
  @ApiResponse({ status: 200, description: 'List of workspaces returned' })
  async GetAll() {
    return this.tenantService.GetAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workspace by ID' })
  @ApiResponse({ status: 200, description: 'Workspace found' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async GetById(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantService.GetById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new workspace' })
  @ApiResponse({ status: 201, description: 'Workspace created' })
  async Insert(@Body() dto: CreateWorkspaceDto) {
    return this.tenantService.Insert(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update workspace metadata' })
  @ApiResponse({ status: 200, description: 'Workspace updated' })
  async Update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.tenantService.Update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a workspace' })
  @ApiResponse({ status: 204, description: 'Workspace deleted' })
  async Delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantService.Delete(id);
  }
}
