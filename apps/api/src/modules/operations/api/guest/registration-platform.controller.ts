import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Patch, Query } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import type { CreateRegistrationPlatformInput, UpdateRegistrationPlatformInput } from '@prism/types';
import {
  CreateRegistrationPlatformDto,
  ImportHeadcountDto,
  RegistrationPlatformActorDto,
  UpdateRegistrationPlatformDto,
} from './registration-platform.dto';
import { RegistrationPlatformService } from '../../application/guest/registration-platform.service';

@Controller('events/:eventId/registration-platform')
export class OpsRegistrationPlatformController {
  constructor(
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    private readonly registrationPlatformService: RegistrationPlatformService,
  ) {}

  @Get()
  get(@Param('eventId') eventId: string, @Query() actorInput: RegistrationPlatformActorDto) {
    this.eventAccessPolicyService.resolveActor(actorInput);
    return this.registrationPlatformService.getByEventId(eventId).then((p) =>
      p ? this.registrationPlatformService.mapRegistrationPlatform(p) : null,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  upsert(
    @Param('eventId') eventId: string,
    @Body() dto: CreateRegistrationPlatformDto,
    @Query() actorInput: RegistrationPlatformActorDto,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    const input: CreateRegistrationPlatformInput = {
      platformType: dto.platformType as CreateRegistrationPlatformInput['platformType'],
      supplierId: dto.supplierId,
      expectedPaxMin: dto.expectedPaxMin,
      expectedPaxMax: dto.expectedPaxMax,
      setupNotes: dto.setupNotes,
    };
    return this.registrationPlatformService
      .upsert(eventId, input, actor)
      .then((p) => this.registrationPlatformService.mapRegistrationPlatform(p));
  }

  @Patch()
  update(
    @Param('eventId') eventId: string,
    @Body() dto: UpdateRegistrationPlatformDto,
    @Query() actorInput: RegistrationPlatformActorDto,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    const input: UpdateRegistrationPlatformInput = {
      ...(dto.platformType !== undefined && { platformType: dto.platformType as UpdateRegistrationPlatformInput['platformType'] }),
      ...(dto.supplierId !== undefined && { supplierId: dto.supplierId }),
      ...(dto.expectedPaxMin !== undefined && { expectedPaxMin: dto.expectedPaxMin }),
      ...(dto.expectedPaxMax !== undefined && { expectedPaxMax: dto.expectedPaxMax }),
      ...(dto.status !== undefined && { status: dto.status as UpdateRegistrationPlatformInput['status'] }),
      ...(dto.setupNotes !== undefined && { setupNotes: dto.setupNotes }),
    };
    return this.registrationPlatformService
      .update(eventId, input, actor)
      .then((p) => this.registrationPlatformService.mapRegistrationPlatform(p));
  }

  @Post('headcount-import')
  @HttpCode(HttpStatus.CREATED)
  importHeadcount(
    @Param('eventId') eventId: string,
    @Body() dto: ImportHeadcountDto,
    @Query() actorInput: RegistrationPlatformActorDto,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    return this.registrationPlatformService
      .importHeadcount(eventId, {
        headcountSource: dto.headcountSource,
        importedHeadcount: dto.importedHeadcount,
        importedFileName: dto.importedFileName,
      }, actor)
      .then((p) => this.registrationPlatformService.mapRegistrationPlatform(p));
  }
}
