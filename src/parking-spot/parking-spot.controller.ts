import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ParkingSpotService } from './parking-spot.service';
import { CreateParkingSpotDto } from './dto/create-parking-spot.dto';
import { UpdateParkingSpotDto } from './dto/update-parking-spot.dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('parking-spots')
export class ParkingSpotController {
  constructor(private readonly parkingSpotService: ParkingSpotService) {}

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateParkingSpotDto) {
    return this.parkingSpotService.create(dto);
  }

  @Roles('admin', 'empleado')
  @Get()
  findAll() {
    return this.parkingSpotService.findAll();
  }

  @Roles('admin', 'empleado')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.parkingSpotService.findOne(id);
  }

  @Roles('admin')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateParkingSpotDto,
  ) {
    return this.parkingSpotService.update(id, dto);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.parkingSpotService.remove(id);
  }

  //CASO 2: OCUPACIÓN 

  @Roles('empleado', 'admin')
  @Get('/stats/occupancy')
  getOccupancy() {
    return this.parkingSpotService.getCurrentOccupancy();
  }
}
