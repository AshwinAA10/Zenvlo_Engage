import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CustomerService } from '../services/customer.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  CustomerQueryDto,
  ImportCustomersDto,
  ImportCsvContentDto,
  CustomerResponseDto,
} from '../models/customer.dto';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { TenantGuard } from '../../../guards/tenant.guard';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  @ApiOperation({ summary: 'Get all customers for the authenticated business (paginated)' })
  async GetAll(@Req() req: any, @Query() query: CustomerQueryDto) {
    const businessId = req.user.business_id;
    return this.customerService.GetAll(businessId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer by ID' })
  @ApiResponse({ status: 200, type: CustomerResponseDto })
  async GetById(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const businessId = req.user.business_id;
    return this.customerService.GetById(businessId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new customer manually' })
  @ApiResponse({ status: 201, type: CustomerResponseDto })
  async Insert(@Req() req: any, @Body() dto: CreateCustomerDto) {
    const businessId = req.user.business_id;
    const userId = req.user.id || req.user.sub;
    return this.customerService.Insert(businessId, dto, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update customer details' })
  @ApiResponse({ status: 200, type: CustomerResponseDto })
  async Update(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    const businessId = req.user.business_id;
    const userId = req.user.id || req.user.sub;
    return this.customerService.Update(businessId, id, dto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete customer' })
  async Delete(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const businessId = req.user.business_id;
    return this.customerService.Delete(businessId, id);
  }

  @Post('import')
  @ApiOperation({ summary: 'Batch import customers' })
  async ImportBatch(@Req() req: any, @Body() dto: ImportCustomersDto) {
    const businessId = req.user.business_id;
    const userId = req.user.id || req.user.sub;
    return this.customerService.ImportBatch(businessId, dto.customers, userId);
  }

  @Post('import-csv')
  @ApiOperation({ summary: 'Import customers from raw CSV text content' })
  async ImportCsv(@Req() req: any, @Body() dto: ImportCsvContentDto) {
    const businessId = req.user.business_id;
    const userId = req.user.id || req.user.sub;
    return this.customerService.ImportCsvString(businessId, dto.csv_content, userId);
  }
}
