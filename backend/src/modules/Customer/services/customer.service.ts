import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Customer } from '../entities/customer.entity';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  CustomerQueryDto,
  ImportCustomerItemDto,
} from '../models/customer.dto';

@Injectable()
export class CustomerService {
  private sanitizePhone(phone: string): string {
    const cleaned = phone.replace(/[^\d+]/g, '').trim();
    return cleaned;
  }

  async GetAll(
    businessId: string,
    query: CustomerQueryDto,
  ): Promise<{ data: Customer[]; total: number; page: number; limit: number }> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const qb = Customer.createQueryBuilder('customer')
      .where('customer.business_id = :businessId', { businessId })
      .andWhere('customer.status = 1');

    if (query.search && query.search.trim().length > 0) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(customer.name) LIKE :search OR customer.phone LIKE :search OR LOWER(customer.email) LIKE :search)',
        { search },
      );
    }

    qb.orderBy('customer.created_on', 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async GetById(businessId: string, id: string): Promise<Customer> {
    const customer = await Customer.findOne({
      where: { id, business_id: businessId, status: 1 },
    });
    if (!customer) {
      throw new NotFoundException(`Customer with ID '${id}' not found`);
    }
    return customer;
  }

  async Insert(
    businessId: string,
    dto: CreateCustomerDto,
    userId: string,
  ): Promise<Customer> {
    const phone = this.sanitizePhone(dto.phone);
    if (!phone) {
      throw new BadRequestException('A valid phone number is required');
    }

    const customer = new Customer();
    customer.business_id = businessId;
    customer.name = dto.name.trim();
    customer.phone = phone;
    customer.email = dto.email ? dto.email.trim().toLowerCase() : null;
    customer.notes = dto.notes ? dto.notes.trim() : null;
    customer.tags = dto.tags && Array.isArray(dto.tags) ? dto.tags : [];
    customer.created_by_id = userId;
    customer.updated_by_id = userId;

    return customer.save();
  }

  async Update(
    businessId: string,
    id: string,
    dto: UpdateCustomerDto,
    userId: string,
  ): Promise<Customer> {
    const customer = await this.GetById(businessId, id);

    if (dto.name !== undefined) {
      customer.name = dto.name.trim();
    }
    if (dto.phone !== undefined) {
      const sanitized = this.sanitizePhone(dto.phone);
      if (!sanitized) throw new BadRequestException('Invalid phone number format');
      customer.phone = sanitized;
    }
    if (dto.email !== undefined) {
      customer.email = dto.email ? dto.email.trim().toLowerCase() : null;
    }
    if (dto.notes !== undefined) {
      customer.notes = dto.notes ? dto.notes.trim() : null;
    }
    if (dto.tags !== undefined) {
      customer.tags = Array.isArray(dto.tags) ? dto.tags : [];
    }

    customer.updated_by_id = userId;
    return customer.save();
  }

  async Delete(businessId: string, id: string): Promise<void> {
    const customer = await this.GetById(businessId, id);
    await customer.softRemove();
  }

  async ImportBatch(
    businessId: string,
    items: ImportCustomerItemDto[],
    userId: string,
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        if (!item.name || !item.phone) {
          skipped++;
          errors.push(`Row ${i + 1}: Name and Phone are required`);
          continue;
        }

        const phone = this.sanitizePhone(item.phone);
        if (!phone) {
          skipped++;
          errors.push(`Row ${i + 1}: Invalid phone number '${item.phone}'`);
          continue;
        }

        const customer = new Customer();
        customer.business_id = businessId;
        customer.name = item.name.trim();
        customer.phone = phone;
        customer.email = item.email ? item.email.trim().toLowerCase() : null;
        customer.notes = item.notes ? item.notes.trim() : null;
        customer.tags = item.tags && Array.isArray(item.tags) ? item.tags : [];
        customer.created_by_id = userId;
        customer.updated_by_id = userId;

        await customer.save();
        imported++;
      } catch (err: any) {
        skipped++;
        errors.push(`Row ${i + 1}: ${err.message || 'Failed to save customer'}`);
      }
    }

    return { imported, skipped, errors };
  }

  async ImportCsvString(
    businessId: string,
    csvContent: string,
    userId: string,
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const lines = csvContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      throw new BadRequestException('CSV content must contain a header row and at least one data row');
    }

    const headers = lines[0]
      .split(',')
      .map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));

    const nameIdx = headers.findIndex((h) => h === 'name' || h === 'fullname' || h === 'customer_name');
    const phoneIdx = headers.findIndex((h) => h === 'phone' || h === 'mobile' || h === 'whatsapp' || h === 'contact');
    const emailIdx = headers.findIndex((h) => h === 'email');
    const notesIdx = headers.findIndex((h) => h === 'notes' || h === 'note');
    const tagsIdx = headers.findIndex((h) => h === 'tags' || h === 'tag');

    if (nameIdx === -1 || phoneIdx === -1) {
      throw new BadRequestException("CSV header must include 'name' and 'phone' columns");
    }

    const items: ImportCustomerItemDto[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Basic CSV comma splitting respecting quoted strings
      const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((p) => p.trim().replace(/^"|"$/g, ''));

      const name = parts[nameIdx] || '';
      const phone = parts[phoneIdx] || '';
      const email = emailIdx !== -1 ? parts[emailIdx] : undefined;
      const notes = notesIdx !== -1 ? parts[notesIdx] : undefined;
      let tags: string[] | undefined = undefined;

      if (tagsIdx !== -1 && parts[tagsIdx]) {
        tags = parts[tagsIdx].split(';').map((t) => t.trim()).filter(Boolean);
      }

      if (name && phone) {
        items.push({ name, phone, email, notes, tags });
      }
    }

    return this.ImportBatch(businessId, items, userId);
  }
}
