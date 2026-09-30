import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Testimonial } from './entities/testimonial.entity';
import { TestimonialService } from './services/testimonial.service';
import { TestimonialController } from './controllers/testimonial.controller';
import { BusinessModule } from '../Business/Business.module';

@Module({
  imports: [TypeOrmModule.forFeature([Testimonial]), BusinessModule],
  controllers: [TestimonialController],
  providers: [TestimonialService],
  exports: [TestimonialService],
})
export class TestimonialModule {}
