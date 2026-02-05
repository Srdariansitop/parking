import {
  Injectable,
  NotFoundException,
  ForbiddenException
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: number, dto: CreateVehicleDto) {
    return this.prisma.vehicle.create({
      data: {
        plate: dto.plate,
        userId
      }
    });
  }

  async findAll(userId: number) {
    return this.prisma.vehicle.findMany({
      where: { userId }
    });
  }

  async findOne(id: number, userId: number) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id }
    });

    if (!vehicle) {
      throw new NotFoundException('Vehículo no encontrado');
    }

    if (vehicle.userId !== userId) {
      throw new ForbiddenException('Acceso denegado');
    }

    return vehicle;
  }

  async update(id: number, userId: number, dto: UpdateVehicleDto) {
    await this.findOne(id, userId);

    return this.prisma.vehicle.update({
      where: { id },
      data: dto
    });
  }

  async remove(id: number, userId: number) {
    await this.findOne(id, userId);

    return this.prisma.vehicle.delete({
      where: { id }
    });
  }
}
