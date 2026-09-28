import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BusinessService } from '../services/business.service';
import { OnboardingDto, UpdateBusinessDto, BusinessResponseDto } from '../models/business.dto';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';

@ApiTags('Business')
@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Post('onboarding')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete initial business onboarding for authenticated user' })
  @ApiResponse({ status: 201, type: BusinessResponseDto })
  async Onboard(@Req() req: any, @Body() dto: OnboardingDto): Promise<BusinessResponseDto> {
    const userId = req.user.id || req.user.sub;
    return this.businessService.InsertOnboarding(userId, dto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated business profile' })
  @ApiResponse({ status: 200, type: BusinessResponseDto })
  async GetProfile(@Req() req: any): Promise<BusinessResponseDto> {
    const userId = req.user.id || req.user.sub;
    const business = await this.businessService.GetByUser(userId);
    if (!business) {
      throw new NotFoundException('Business profile not found for this account. Please complete onboarding.');
    }
    return business;
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update business profile details' })
  @ApiResponse({ status: 200, type: BusinessResponseDto })
  async UpdateProfile(@Req() req: any, @Body() dto: UpdateBusinessDto): Promise<BusinessResponseDto> {
    const userId = req.user.id || req.user.sub;
    const business = await this.businessService.GetByUser(userId);
    if (!business) {
      throw new NotFoundException('Business profile not found for this account.');
    }
    return this.businessService.UpdateProfile(business.id, dto);
  }

  @Get('public/:slug')
  @ApiOperation({ summary: 'Get public business profile for testimonial submission form' })
  @ApiResponse({ status: 200, description: 'Public business branding' })
  async GetPublic(@Param('slug') slug: string) {
    const business = await this.businessService.GetBySlug(slug);
    // Exclude any private metadata/settings
    return {
      id: business.id,
      name: business.name,
      slug: business.slug,
      category: business.category,
      logo_url: business.logo_url,
      website: business.website,
    };
  }
}
