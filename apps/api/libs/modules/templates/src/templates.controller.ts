import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TemplatesService } from './templates.service';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  list() {
    return this.templatesService.listTemplates();
  }

  @Get(':templateId')
  getOne(@Param('templateId') templateId: string) {
    return this.templatesService.getTemplate(templateId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateTemplateDto) {
    return this.templatesService.createTemplate(dto);
  }

  @Patch(':templateId')
  update(@Param('templateId') templateId: string, @Body() dto: UpdateTemplateDto) {
    return this.templatesService.updateTemplate(templateId, dto);
  }

  @Delete(':templateId')
  delete(@Param('templateId') templateId: string) {
    return this.templatesService.deleteTemplate(templateId);
  }
}
