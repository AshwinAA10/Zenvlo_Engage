import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Testimonial, ApprovalStatus } from '../entities/testimonial.entity';
import { Business } from '../../Business/entities/business.entity';
import { Customer } from '../../Customer/entities/customer.entity';
import { RequestLog } from '../../Request/entities/request-log.entity';
import {
  SubmitPublicTestimonialDto,
  UpdateTestimonialStatusDto,
  TestimonialQueryDto,
} from '../models/testimonial.dto';

@Injectable()
export class TestimonialService {
  async SubmitPublic(
    slug: string,
    dto: SubmitPublicTestimonialDto,
  ): Promise<{ success: boolean; message: string; id: string }> {
    const business = await Business.findOne({
      where: { slug: slug.trim().toLowerCase(), status: 1 },
    });

    if (!business) {
      throw new NotFoundException(`Business with address '${slug}' not found`);
    }

    if (!dto.consent_given) {
      throw new BadRequestException('Customer consent is required to submit feedback');
    }

    let customerId: string | null = null;
    if (dto.customer_phone) {
      const cleanPhone = dto.customer_phone.replace(/[^\d+]/g, '').trim();
      const existingCustomer = await Customer.findOne({
        where: { business_id: business.id, phone: cleanPhone, status: 1 },
      });
      if (existingCustomer) {
        customerId = existingCustomer.id;
      }
    }

    const testimonial = new Testimonial();
    testimonial.business_id = business.id;
    testimonial.customer_id = customerId;
    testimonial.customer_name = dto.customer_name.trim();
    testimonial.customer_phone = dto.customer_phone
      ? dto.customer_phone.replace(/[^\d+]/g, '').trim()
      : null;
    testimonial.customer_email = dto.customer_email
      ? dto.customer_email.trim().toLowerCase()
      : null;
    testimonial.rating = dto.rating;
    testimonial.content = dto.content.trim();
    testimonial.photo_url = dto.photo_url || null;
    testimonial.video_url = dto.video_url || null;
    testimonial.consent_given = true;
    testimonial.consent_timestamp = new Date();
    testimonial.approval_status = 'PENDING';
    testimonial.source = 'PUBLIC_FORM';
    testimonial.created_by_id = business.user_id;
    testimonial.updated_by_id = business.user_id;

    await testimonial.save();

    // Link feedback with pending WhatsApp request log if matched
    if (testimonial.customer_phone) {
      try {
        const unlinkedLog = await RequestLog.createQueryBuilder('log')
          .where('log.business_id = :businessId', { businessId: business.id })
          .andWhere('log.customer_phone = :phone', {
            phone: testimonial.customer_phone,
          })
          .andWhere('log.testimonial_id IS NULL')
          .orderBy('log.created_on', 'DESC')
          .getOne();

        if (unlinkedLog) {
          unlinkedLog.testimonial_id = testimonial.id;
          unlinkedLog.response_received_at = new Date();
          await unlinkedLog.save();
        }
      } catch {
        // Silently continue if log linking fails
      }
    }

    return {
      success: true,
      message: 'Your review has been submitted for review. Thank you!',
      id: testimonial.id,
    };
  }

  async GetAll(
    businessId: string,
    query: TestimonialQueryDto,
  ): Promise<{
    data: Testimonial[];
    total: number;
    page: number;
    limit: number;
    counts: {
      total: number;
      pending: number;
      approved: number;
      rejected: number;
      averageRating: number;
    };
  }> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const qb = Testimonial.createQueryBuilder('testimonial')
      .where('testimonial.business_id = :businessId', { businessId })
      .andWhere('testimonial.status = 1');

    if (query.status && query.status !== 'ALL') {
      qb.andWhere('testimonial.approval_status = :status', {
        status: query.status.toUpperCase(),
      });
    }

    qb.orderBy('testimonial.created_on', 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    // Summary counts for dashboard tabs & metrics
    const allBusinessTestimonials = await Testimonial.find({
      where: { business_id: businessId, status: 1 },
      select: ['id', 'approval_status', 'rating'],
    });

    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let ratingSum = 0;

    for (const t of allBusinessTestimonials) {
      if (t.approval_status === 'PENDING') pending++;
      else if (t.approval_status === 'APPROVED') {
        approved++;
        ratingSum += t.rating;
      } else if (t.approval_status === 'REJECTED') rejected++;
    }

    const averageRating =
      approved > 0 ? Number((ratingSum / approved).toFixed(1)) : 5.0;

    return {
      data,
      total,
      page,
      limit,
      counts: {
        total: allBusinessTestimonials.length,
        pending,
        approved,
        rejected,
        averageRating,
      },
    };
  }

  async GetById(businessId: string, id: string): Promise<Testimonial> {
    const testimonial = await Testimonial.findOne({
      where: { id, business_id: businessId, status: 1 },
    });
    if (!testimonial) {
      throw new NotFoundException(`Testimonial with ID '${id}' not found`);
    }
    return testimonial;
  }

  async UpdateStatus(
    businessId: string,
    id: string,
    dto: UpdateTestimonialStatusDto,
    userId: string,
  ): Promise<Testimonial> {
    const testimonial = await this.GetById(businessId, id);

    testimonial.approval_status = dto.status as ApprovalStatus;
    testimonial.updated_by_id = userId;

    if (dto.status === 'APPROVED') {
      testimonial.approved_at = new Date();
      testimonial.approved_by_id = userId;
      testimonial.rejection_reason = null;
    } else if (dto.status === 'REJECTED') {
      testimonial.approved_at = null;
      testimonial.approved_by_id = null;
      testimonial.rejection_reason = dto.rejection_reason || 'Rejected by business owner';
    }

    return testimonial.save();
  }

  async Delete(businessId: string, id: string): Promise<void> {
    const testimonial = await this.GetById(businessId, id);
    await testimonial.softRemove();
  }
}
