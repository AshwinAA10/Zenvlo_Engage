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
import { CampaignService } from '../services/campaign.service';
import { CreateCampaignDto, UpdateCampaignDto } from '../models/campaign.dto';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { TenantGuard } from '../../../guards/tenant.guard';

@ApiTags('Campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('campaigns')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Get()
  @ApiOperation({ summary: 'Get all campaigns for workspace' })
  async GetAll() {
    return this.campaignService.GetAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get campaign by ID' })
  async GetById(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaignService.GetById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new campaign' })
  async Insert(@Body() dto: CreateCampaignDto) {
    return this.campaignService.Insert(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update campaign details' })
  async Update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaignService.Update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a campaign' })
  async Delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaignService.Delete(id);
  }
}
