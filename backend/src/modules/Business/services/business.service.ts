import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Business } from '../entities/business.entity';
import { OnboardingDto, UpdateBusinessDto } from '../models/business.dto';

@Injectable()
export class BusinessService {
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async GetByUser(userId: string): Promise<Business | null> {
    return Business.findOne({
      where: { user_id: userId, status: 1 },
      order: { created_on: 'ASC' },
    });
  }

  async GetById(id: string): Promise<Business> {
    const business = await Business.findOne({
      where: { id, status: 1 },
    });
    if (!business) {
      throw new NotFoundException(`Business with ID '${id}' not found`);
    }
    return business;
  }

  async GetBySlug(slug: string): Promise<Business> {
    const business = await Business.findOne({
      where: { slug, status: 1 },
    });
    if (!business) {
      throw new NotFoundException(`Business with slug '${slug}' not found`);
    }
    return business;
  }

  async InsertOnboarding(userId: string, dto: OnboardingDto): Promise<Business> {
    // Check if user already has an active business
    const existing = await this.GetByUser(userId);
    if (existing) {
      // If already exists, update details instead of throwing error
      return this.UpdateProfile(existing.id, dto);
    }

    const business = new Business();
    business.user_id = userId;
    business.name = dto.name.trim();
    business.category = dto.category || 'General';
    business.phone = dto.phone || null;
    business.website = dto.website || null;
    business.location = dto.location || null;
    business.logo_url = dto.logo_url || null;

    let baseSlug = this.generateSlug(dto.name);
    if (!baseSlug) baseSlug = 'business';

    let uniqueSlug = baseSlug;
    let counter = 1;
    while (await Business.findOne({ where: { slug: uniqueSlug } })) {
      uniqueSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    business.slug = uniqueSlug;
    return business.save();
  }

  async UpdateProfile(businessId: string, dto: UpdateBusinessDto): Promise<Business> {
    const business = await this.GetById(businessId);

    if (dto.name !== undefined) {
      business.name = dto.name.trim();
    }
    if (dto.category !== undefined) {
      business.category = dto.category;
    }
    if (dto.phone !== undefined) {
      business.phone = dto.phone;
    }
    if (dto.website !== undefined) {
      business.website = dto.website;
    }
    if (dto.location !== undefined) {
      business.location = dto.location;
    }
    if (dto.logo_url !== undefined) {
      business.logo_url = dto.logo_url;
    }

    return business.save();
  }
}
