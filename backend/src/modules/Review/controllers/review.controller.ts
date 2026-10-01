import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
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
import { ReviewService } from '../services/review.service';
import {
  SearchPlaceDto,
  ConnectPlaceDto,
  ReviewQueryDto,
  ToggleReviewVisibilityDto,
  ReviewStatsDto,
} from '../models/review.dto';
import { ReviewSource } from '../entities/review-source.entity';
import { Review } from '../entities/review.entity';

@ApiTags('Reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get('places/search')
  @ApiOperation({ summary: 'Search Google Places for local business listings' })
  @ApiResponse({ status: 200 })
  async SearchPlaces(@Query() queryDto: SearchPlaceDto) {
    return this.reviewService.SearchPlaces(queryDto.query);
  }

  @Post('sources/connect')
  @ApiOperation({
    summary: 'Connect a Google Place to business and import verified reviews',
  })
  @ApiResponse({ status: 201 })
  async ConnectPlace(
    @Req() req: any,
    @Body() dto: ConnectPlaceDto,
  ) {
    const businessId = req.user.business_id;
    return this.reviewService.ConnectPlace(businessId, dto.place_id);
  }

  @Post('sources/:id/sync')
  @ApiOperation({
    summary: 'Synchronize and refresh latest reviews from connected Google Place',
  })
  @ApiResponse({ status: 200 })
  async SyncReviews(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const businessId = req.user.business_id;
    return this.reviewService.SyncReviews(businessId, id);
  }

  @Get('sources')
  @ApiOperation({ summary: 'Get all connected review sources for business' })
  @ApiResponse({ status: 200, type: [ReviewSource] })
  async GetSources(@Req() req: any): Promise<ReviewSource[]> {
    const businessId = req.user.business_id;
    return this.reviewService.GetSources(businessId);
  }

  @Get()
  @ApiOperation({
    summary: 'Get paginated imported reviews with rating and visibility filters',
  })
  @ApiResponse({ status: 200 })
  async GetReviews(@Req() req: any, @Query() query: ReviewQueryDto) {
    const businessId = req.user.business_id;
    return this.reviewService.GetReviews(businessId, query);
  }

  @Patch(':id/visibility')
  @ApiOperation({
    summary: 'Toggle review visibility for inclusion in website widgets',
  })
  @ApiResponse({ status: 200, type: Review })
  async ToggleVisibility(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleReviewVisibilityDto,
  ): Promise<Review> {
    const businessId = req.user.business_id;
    return this.reviewService.ToggleVisibility(
      businessId,
      id,
      dto.is_visible,
    );
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get aggregate review statistics and rating distribution',
  })
  @ApiResponse({ status: 200, type: ReviewStatsDto })
  async GetStats(@Req() req: any): Promise<ReviewStatsDto> {
    const businessId = req.user.business_id;
    return this.reviewService.GetReviewStats(businessId);
  }
}
