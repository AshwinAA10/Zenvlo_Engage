import { Injectable, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Contact } from '../entities/contact.entity';
import { CreateContactDto, UpdateContactDto } from '../models/contact.dto';
import { CLS_WORKSPACE_ID } from '../../../common/constants';

@Injectable()
export class ContactService {
  constructor(private readonly cls: ClsService) {}

  async GetAll(): Promise<Contact[]> {
    const workspaceId = this.cls.get<string>(CLS_WORKSPACE_ID);
    return Contact.find({
      where: { workspace_id: workspaceId, status: 1 },
      order: { created_on: 'DESC' },
    });
  }

  async GetById(id: string): Promise<Contact> {
    const workspaceId = this.cls.get<string>(CLS_WORKSPACE_ID);
    const contact = await Contact.findOne({
      where: { id, workspace_id: workspaceId, status: 1 },
    });
    if (!contact) {
      throw new NotFoundException(`Contact with ID '${id}' not found`);
    }
    return contact;
  }

  async Insert(dto: CreateContactDto): Promise<Contact> {
    const contact = new Contact();
    contact.first_name = dto.first_name || null;
    contact.last_name = dto.last_name || null;
    contact.phone_number = dto.phone_number || null;
    contact.instagram_handle = dto.instagram_handle || null;
    contact.email = dto.email || null;
    contact.custom_attributes = dto.custom_attributes || {};
    contact.tags = dto.tags || [];

    return contact.save();
  }

  async Update(id: string, dto: UpdateContactDto): Promise<Contact> {
    const contact = await this.GetById(id);

    if (dto.first_name !== undefined) contact.first_name = dto.first_name;
    if (dto.last_name !== undefined) contact.last_name = dto.last_name;
    if (dto.phone_number !== undefined) contact.phone_number = dto.phone_number;
    if (dto.instagram_handle !== undefined) contact.instagram_handle = dto.instagram_handle;
    if (dto.email !== undefined) contact.email = dto.email;
    if (dto.custom_attributes !== undefined) contact.custom_attributes = dto.custom_attributes;
    if (dto.tags !== undefined) contact.tags = dto.tags;

    return contact.save();
  }

  async Delete(id: string): Promise<void> {
    const contact = await this.GetById(id);
    await contact.softRemove();
  }
}
