import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TestimonialService } from '../services/testimonial.service';
import { BusinessService } from '../../Business/services/business.service';
import {
  SubmitPublicTestimonialDto,
  UpdateTestimonialStatusDto,
  TestimonialQueryDto,
} from '../models/testimonial.dto';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { TenantGuard } from '../../../guards/tenant.guard';

@ApiTags('Testimonials')
@Controller('testimonials')
export class TestimonialController {
  constructor(
    private readonly testimonialService: TestimonialService,
    private readonly businessService: BusinessService,
  ) {}

  // --------------------------------------------------------------------------
  // PUBLIC ENDPOINTS (No customer account or login required)
  // --------------------------------------------------------------------------

  @Get('public/:slug/info')
  @ApiOperation({ summary: 'Get business information for the public testimonial form' })
  async GetPublicFormInfo(@Param('slug') slug: string) {
    const business = await this.businessService.GetBySlug(slug);
    if (!business) {
      throw new NotFoundException(`Business with slug '${slug}' not found`);
    }
    return {
      id: business.id,
      name: business.name,
      slug: business.slug,
      category: business.category,
      logo_url: business.logo_url,
      location: business.location,
    };
  }

  @Post('public/:slug')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a new customer testimonial via public link' })
  @ApiResponse({ status: 201, description: 'Testimonial submitted as Pending' })
  async SubmitPublic(
    @Param('slug') slug: string,
    @Body() dto: SubmitPublicTestimonialDto,
  ) {
    return this.testimonialService.SubmitPublic(slug, dto);
  }

  // --------------------------------------------------------------------------
  // AUTHENTICATED BUSINESS ENDPOINTS (Strictly tenant-isolated)
  // --------------------------------------------------------------------------

  @Get()
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all testimonials for authenticated business with counts' })
  async GetAll(@Req() req: any, @Query() query: TestimonialQueryDto) {
    const businessId = req.user.business_id;
    return this.testimonialService.GetAll(businessId, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get testimonial details by ID' })
  async GetById(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const businessId = req.user.business_id;
    return this.testimonialService.GetById(businessId, id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve or Reject a submitted testimonial' })
  async UpdateStatus(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTestimonialStatusDto,
  ) {
    const businessId = req.user.business_id;
    const userId = req.user.id || req.user.sub;
    return this.testimonialService.UpdateStatus(businessId, id, dto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a testimonial' })
  async Delete(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const businessId = req.user.business_id;
    return this.testimonialService.Delete(businessId, id);
  }
}
