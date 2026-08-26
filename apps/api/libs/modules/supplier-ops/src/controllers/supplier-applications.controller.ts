import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { createSupplierApplicationSchema, type CreateSupplierApplicationInput } from '@prism/types';
import { zodBody } from '@prism/shared';
import { SupplierApplicationService } from '../services/supplier-application.service';

@Controller('supplier-applications')
export class OpsSupplierApplicationsController {
  constructor(private readonly supplierApplicationService: SupplierApplicationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body(zodBody(createSupplierApplicationSchema)) input: CreateSupplierApplicationInput) {
    return this.supplierApplicationService.createSupplierApplication(input);
  }

  @Get('categories')
  listCategories() {
    return this.supplierApplicationService.listPublicCategories();
  }
}
