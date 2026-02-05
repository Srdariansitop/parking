import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateParkingSpotDto } from './dto/create-parking-spot.dto';
import { UpdateParkingSpotDto } from './dto/update-parking-spot.dto';

@Injectable()
export class ParkingSpotService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateParkingSpotDto) {
    return this.prisma.parkingSpot.create({
      data: dto,
    });
  }

  findAll() {
    return this.prisma.parkingSpot.findMany();
  }

  async findOne(id: number) {
    const spot = await this.prisma.parkingSpot.findUnique({
      where: { id },
    });

    if (!spot) {
      throw new NotFoundException('Plaza no encontrada');
    }

    return spot;
  }

  async update(id: number, dto: UpdateParkingSpotDto) {
    await this.findOne(id);

    return this.prisma.parkingSpot.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.parkingSpot.delete({
      where: { id },
    });
  }

  // CASO 2: OCUPACIÓN ACTUAL 

  async getCurrentOccupancy() {
  const now = new Date();

  // 1️⃣ Total de plazas
  const totalSpots = await this.prisma.parkingSpot.count();

  // 2️⃣ Plazas ocupadas actualmente
  const occupiedSpots = await this.prisma.parkingSpot.count({
    where: {
      reservations: {
        some: {
          startTime: { lte: now },
          endTime: { gte: now },
        },
      },
    },
  });

  // 3️⃣ Plazas libres (sin reservas activas)
  const freeSpotsList = await this.prisma.parkingSpot.findMany({
    where: {
      reservations: {
        none: {
          startTime: { lte: now },
          endTime: { gte: now },
        },
      },
    },
    select: {
      code: true,
    },
  });

  const freeCodes = freeSpotsList.map((spot) => spot.code);

  // 4️⃣ Devolver resultado
  return {
    totalSpots,
    occupiedSpots,
    freeSpots: totalSpots - occupiedSpots,
    occupancyPercentage:
      totalSpots === 0
        ? 0
        : Math.round((occupiedSpots / totalSpots) * 100),
    freeCodes, // códigos de las plazas disponibles
  };
}

}
