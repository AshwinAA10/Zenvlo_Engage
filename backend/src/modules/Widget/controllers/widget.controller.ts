import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  Res,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { TenantGuard } from '../../../guards/tenant.guard';
import { WidgetService } from '../services/widget.service';
import {
  CreateWidgetDto,
  UpdateWidgetDto,
  PublicWidgetResponseDto,
} from '../models/widget.dto';
import { Widget } from '../entities/widget.entity';

@ApiTags('Widgets')
@Controller('widgets')
export class WidgetController {
  constructor(private readonly widgetService: WidgetService) {}

  // --------------------------------------------------------------------------
  // PUBLIC ENDPOINTS (No login or credentials required)
  // --------------------------------------------------------------------------

  @Get('public/:id')
  @ApiOperation({
    summary:
      'Fetch public widget configuration and privacy-safe curated reviews/testimonials',
  })
  @ApiResponse({ status: 200, type: PublicWidgetResponseDto })
  async GetPublicWidget(
    @Param('id') id: string,
  ): Promise<PublicWidgetResponseDto> {
    return this.widgetService.GetPublicWidgetData(id);
  }

  @Get('embed.js')
  @ApiOperation({ summary: 'Universal widget JavaScript loader snippet' })
  async ServeEmbedScript(@Res() res: any) {
    const script = this.widgetService.GenerateEmbedScript();
    if (typeof res.header === 'function') {
      res.header('Content-Type', 'application/javascript; charset=utf-8');
      res.header('Cache-Control', 'public, max-age=3600');
    } else if (typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
    return res.send(script);
  }

  // --------------------------------------------------------------------------
  // AUTHENTICATED BUSINESS ENDPOINTS (Strictly tenant-isolated)
  // --------------------------------------------------------------------------

  @Post()
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new website testimonial widget' })
  @ApiResponse({ status: 201, type: Widget })
  async Create(
    @Req() req: any,
    @Body() dto: CreateWidgetDto,
  ): Promise<Widget> {
    const businessId = req.user.business_id;
    const userId = req.user.id;
    return this.widgetService.CreateWidget(businessId, dto, userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all widgets created for business' })
  @ApiResponse({ status: 200, type: [Widget] })
  async GetAll(@Req() req: any): Promise<Widget[]> {
    const businessId = req.user.business_id;
    return this.widgetService.GetWidgets(businessId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get widget details by ID' })
  @ApiResponse({ status: 200, type: Widget })
  async GetById(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Widget> {
    const businessId = req.user.business_id;
    return this.widgetService.GetWidgetById(businessId, id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update widget styling and review filtering' })
  @ApiResponse({ status: 200, type: Widget })
  async Update(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWidgetDto,
  ): Promise<Widget> {
    const businessId = req.user.business_id;
    return this.widgetService.UpdateWidget(businessId, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete widget' })
  @ApiResponse({ status: 200 })
  async Delete(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const businessId = req.user.business_id;
    return this.widgetService.DeleteWidget(businessId, id);
  }
}
