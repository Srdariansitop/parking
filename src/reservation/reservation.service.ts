import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { LogsService } from '../logs/logs.service';
import { LogType } from '../logs/schemas/log.schema';



@Injectable()
export class ReservationService {
  constructor(
    private prisma: PrismaService,
    private readonly logsService: LogsService,
  ) {}

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

  // 2️⃣ Validar solapamiento del vehículo
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

  // 3️⃣ Buscar plaza disponible
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
  const reservation = await this.prisma.reservation.create({
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

  // 5️⃣ Crear log en MongoDB
  await this.logsService.create(
    LogType.RESERVATION_CREATED,
    userId,
    dto.vehicleId,
    availableSpot.id,
    {
      reservationId: reservation.id,
      startTime: start,
      endTime: end,
    },
  );

  return reservation;
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
  const now = new Date();

  // 1️⃣ Obtener reserva válida
  const reservation = await this.prisma.reservation.findFirst({
    where: {
      id,
      userId,
      cancel: false,
    },
  });

  if (!reservation) {
    throw new NotFoundException(
      'Reserva no encontrada o ya fue cancelada',
    );
  }

  // 2️⃣ Validar que NO sea una reserva pasada
  if (reservation.endTime <= now) {
    throw new BadRequestException(
      'No se puede cancelar una reserva que ya ha finalizado',
    );
  }

  // 3️⃣ Cancelar reserva
  const cancelledReservation = await this.prisma.reservation.update({
    where: { id },
    data: {
      cancel: true,
    },
  });

  // 4️⃣ Crear log en MongoDB
  await this.logsService.create(
    LogType.RESERVATION_CANCELLED,
    userId,
    reservation.vehicleId,
    reservation.parkingSpotId,
    {
      reservationId: reservation.id,
      startTime: reservation.startTime,
      endTime: reservation.endTime,
      cancelledAt: now,
    },
  );

  return cancelledReservation;
}

//entrada 
async registerEntry(reservationId: number) {
  const now = new Date();

  const reservation = await this.prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      vehicle: true,
      parkingSpot: true,
    },
  });

  if (!reservation || reservation.cancel) {
    throw new BadRequestException('Reserva inválida o cancelada');
  }

  if (now < reservation.startTime || now > reservation.endTime) {
    throw new BadRequestException(
      'La entrada solo es válida dentro del horario de la reserva',
    );
  }

  // Crear log de entrada
  await this.logsService.create(
    LogType.VEHICLE_ENTRY,
    reservation.userId,
    reservation.vehicleId,
    reservation.parkingSpotId,
    {
      reservationId: reservation.id,
      plate: reservation.vehicle.plate,
      spotCode: reservation.parkingSpot.code,
      timestamp: now,
    },
  );

  return {
    message: 'Entrada registrada correctamente',
    reservationId,
  };
}





//salida 
async registerExit(reservationId: number) {
  const now = new Date();

  const reservation = await this.prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      vehicle: true,
      parkingSpot: true,
    },
  });

  if (!reservation || reservation.cancel) {
    throw new BadRequestException('Reserva inválida o cancelada');
  }

  // Crear log de salida
  await this.logsService.create(
    LogType.VEHICLE_EXIT,
    reservation.userId,
    reservation.vehicleId,
    reservation.parkingSpotId,
    {
      reservationId: reservation.id,
      plate: reservation.vehicle.plate,
      spotCode: reservation.parkingSpot.code,
      timestamp: now,
    },
  );

  return {
    message: 'Salida registrada correctamente',
    reservationId,
  };
}








}
