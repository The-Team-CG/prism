import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CreateSupplierApplicationDto } from '../dto/supplier-application.dto';
import { SupplierApplicationService } from '../services/supplier-application.service';

@Controller('supplier-applications')
export class OpsSupplierApplicationsController {
  constructor(private readonly supplierApplicationService: SupplierApplicationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateSupplierApplicationDto) {
    return this.supplierApplicationService.createSupplierApplication(dto);
  }

  @Get('categories')
  listCategories() {
    return this.supplierApplicationService.listPublicCategories();
  }
}
