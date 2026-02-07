import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';

@Injectable()
export class ReservationService {
  constructor(private prisma: PrismaService) {}

async create(userId: number, dto: CreateReservationDto) {
  if (!dto || !dto.startTime || !dto.endTime || !dto.vehicleId) {
    throw new BadRequestException('Datos de reserva incompletos');
  }

  // 1️⃣ Verificar que el vehículo pertenezca al usuario
  const vehicle = await this.prisma.vehicle.findFirst({
    where: {
      id: dto.vehicleId,
      userId: userId,
    },
  });

  if (!vehicle) {
    throw new ForbiddenException(
      'El vehículo no pertenece al usuario autenticado',
    );
  }

  const start = new Date(dto.startTime);
  const end = new Date(dto.endTime);

  if (start >= end) {
    throw new BadRequestException(
      'La fecha de inicio debe ser menor a la fecha final',
    );
  }

  // 2️⃣ Validar que el vehículo NO tenga otra reserva solapada
  const vehicleConflict = await this.prisma.reservation.findFirst({
    where: {
      vehicleId: dto.vehicleId,
      cancel: false,
      AND: [
        { startTime: { lt: end } },
        { endTime: { gt: start } },
      ],
    },
  });

  if (vehicleConflict) {
    throw new BadRequestException(
      'El vehículo ya tiene una reserva en ese horario',
    );
  }

  // 3️⃣ Buscar una plaza disponible
  const availableSpot = await this.prisma.parkingSpot.findFirst({
    where: {
      reservations: {
        none: {
          cancel: false,
          AND: [
            { startTime: { lt: end } },
            { endTime: { gt: start } },
          ],
        },
      },
    },
  });

  if (!availableSpot) {
    throw new BadRequestException(
      'No hay plazas disponibles en el horario solicitado',
    );
  }

  // 4️⃣ Crear reserva
  return this.prisma.reservation.create({
    data: {
      startTime: start,
      endTime: end,
      userId,
      vehicleId: dto.vehicleId,
      parkingSpotId: availableSpot.id,
      cancel: false,
    },
    include: {
      parkingSpot: true,
      vehicle: true,
    },
  });
}



  async findAll(userId: number) {
    return this.prisma.reservation.findMany({
      where: {
        userId,
        cancel: false,
      },
      include: {
        parkingSpot: true,
        vehicle: true,
      },
    });
  }

  async findOne(id: number, userId: number) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        parkingSpot: true,
        vehicle: true,
      },
    });

    if (!reservation || reservation.cancel) {
      throw new NotFoundException('Reserva no encontrada');
    }

    if (reservation.userId !== userId) {
      throw new ForbiddenException();
    }

    return reservation;
  }

  async update(id: number, userId: number, dto: UpdateReservationDto) {
    await this.findOne(id, userId);

    return this.prisma.reservation.update({
      where: { id },
      data: {
        ...dto,
      },
    });
  }

  // 🧠 Soft delete
  async cancel(id: number, userId: number) {
    await this.findOne(id, userId);

    return this.prisma.reservation.update({
      where: { id },
      data: {
        cancel: true,
      },
    });
  }
}
