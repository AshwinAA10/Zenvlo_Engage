import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewSource } from './entities/review-source.entity';
import { Review } from './entities/review.entity';
import { ReviewService } from './services/review.service';
import { ReviewController } from './controllers/review.controller';
import { IntegrationModule } from '../Integration/Integration.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReviewSource, Review]),
    IntegrationModule,
  ],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
