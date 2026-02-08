import {
  Controller,
  Post,
  Body,
  Req,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('reservations')
export class ReservationController {
  constructor(private readonly service: ReservationService) {}

  // ---------- CLIENTE ----------

  @Roles('cliente')
  @Post()
  create(@Req() req, @Body() dto: CreateReservationDto) {
    return this.service.create(req.user.userId, dto);
  }

  @Roles('cliente')
  @Get()
  findAll(@Req() req) {
    return this.service.findAll(req.user.userId);
  }

  @Roles('cliente')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.service.findOne(id, req.user.userId);
  }

  @Roles('cliente')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Req() req,
    @Body() dto: UpdateReservationDto,
  ) {
    return this.service.update(id, req.user.userId, dto);
  }

  @Roles('cliente')
  @Patch(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.service.cancel(id, req.user.userId);
  }

  // ---------- EMPLEADO / ADMIN ----------

  @Roles('empleado', 'admin')
  @Patch(':id/entry')
  vehicleEntry(@Param('id', ParseIntPipe) id: number) {
    return this.service.registerEntry(id);
  }

  @Roles('empleado', 'admin')
  @Patch(':id/exit')
  vehicleExit(@Param('id', ParseIntPipe) id: number) {
    return this.service.registerExit(id);
  }
}
