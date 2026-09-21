import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ContactService } from '../services/contact.service';
import { CreateContactDto, UpdateContactDto } from '../models/contact.dto';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { TenantGuard } from '../../../guards/tenant.guard';

@ApiTags('Contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('contacts')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Get()
  @ApiOperation({ summary: 'Get all contacts for current workspace' })
  async GetAll() {
    return this.contactService.GetAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contact by ID' })
  async GetById(@Param('id', ParseUUIDPipe) id: string) {
    return this.contactService.GetById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new contact' })
  async Insert(@Body() dto: CreateContactDto) {
    return this.contactService.Insert(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update existing contact' })
  async Update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactService.Update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a contact' })
  async Delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.contactService.Delete(id);
  }
}
