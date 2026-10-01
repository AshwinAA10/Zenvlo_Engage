import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Widget } from './entities/widget.entity';
import { Business } from '../Business/entities/business.entity';
import { Testimonial } from '../Testimonial/entities/testimonial.entity';
import { Review } from '../Review/entities/review.entity';
import { WidgetService } from './services/widget.service';
import { WidgetController } from './controllers/widget.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Widget, Business, Testimonial, Review]),
  ],
  controllers: [WidgetController],
  providers: [WidgetService],
  exports: [WidgetService],
})
export class WidgetModule {}
