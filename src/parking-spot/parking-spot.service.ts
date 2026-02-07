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

  // 2️⃣ Reservas activas actualmente (no canceladas)
  const activeReservations = await this.prisma.reservation.findMany({
    where: {
      cancel: false,
      startTime: { lte: now },
      endTime: { gte: now },
    },
    include: {
      parkingSpot: {
        select: {
          id: true,
          code: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      vehicle: {
        select: {
          id: true,
          plate: true,
        },
      },
    },
  });

  // 3️⃣ Plazas ocupadas (detalle)
  const occupiedSpots = activeReservations.map((reservation) => ({
    spotCode: reservation.parkingSpot.code,
    user: reservation.user,
    vehicle: reservation.vehicle,
    startTime: reservation.startTime,
    endTime: reservation.endTime,
  }));

  const occupiedCount = occupiedSpots.length;

  // 4️⃣ Plazas libres
  const freeSpots = await this.prisma.parkingSpot.findMany({
    where: {
      reservations: {
        none: {
          cancel: false,
          startTime: { lte: now },
          endTime: { gte: now },
        },
      },
    },
    select: {
      id: true,
      code: true,
    },
  });

  // 5️⃣ Respuesta final
  return {
    summary: {
      totalSpots,
      occupiedSpots: occupiedCount,
      freeSpots: totalSpots - occupiedCount,
      occupancyPercentage:
        totalSpots === 0
          ? 0
          : Math.round((occupiedCount / totalSpots) * 100),
    },
    occupied: occupiedSpots,
    free: freeSpots,
  };
}


}
