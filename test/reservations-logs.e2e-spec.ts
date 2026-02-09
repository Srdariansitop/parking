import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import * as bcrypt from 'bcrypt';

describe('Reservations + Logs (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let clientToken: string;
  let adminToken: string;
  let employeeToken: string;

  let reservationId: number;
  let vehicleId: number;

  jest.setTimeout(300000);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    prisma = moduleFixture.get(PrismaService);

    await app.init();
  });

  beforeEach(async () => {
    await prisma.reservation.deleteMany();
    await prisma.vehicle.deleteMany();
    await prisma.parkingSpot.deleteMany();
    await prisma.user.deleteMany();

    const passwordHash = await bcrypt.hash('password', 10);

    const client = await prisma.user.create({
      data: {
        name: 'Cliente',
        email: 'cliente@test.com',
        password: passwordHash,
        role: 'cliente',
      },
    });

    await prisma.user.create({
      data: {
        name: 'Empleado',
        email: 'empleado@test.com',
        password: passwordHash,
        role: 'empleado',
      },
    });

    await prisma.user.create({
      data: {
        name: 'Admin',
        email: 'admin@test.com',
        password: passwordHash,
        role: 'admin',
      },
    });

    const vehicle = await prisma.vehicle.create({
      data: {
        plate: 'LOG-123',
        userId: client.id,
      },
    });
    vehicleId = vehicle.id;

    await prisma.parkingSpot.create({ data: { code: 'LOG-A1' } });

    clientToken = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'cliente@test.com', password: 'password' })
    ).body.access_token;

    employeeToken = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'empleado@test.com', password: 'password' })
    ).body.access_token;

    adminToken = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@test.com', password: 'password' })
    ).body.access_token;

    // ⏱️ Reserva ACTIVA
    const start = new Date(Date.now() - 5 * 60 * 1000); // pasado
    const end = new Date(Date.now() + 60 * 60 * 1000);  // futuro

    const reservation = await prisma.reservation.create({
      data: {
        userId: client.id,
        vehicleId,
        parkingSpotId: (await prisma.parkingSpot.findFirst())!.id,
        startTime: start,
        endTime: end,
        cancel: false,
      },
    });

    reservationId = reservation.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('PATCH /reservations/:id/entry → employee registers entry', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/reservations/${reservationId}/entry`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Entrada registrada');
  });

  it('PATCH /reservations/:id/exit → employee registers exit', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/reservations/${reservationId}/exit`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Salida registrada');
  });

  it('PATCH /reservations/:id/cancel → client cancels reservation', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/reservations/${reservationId}/cancel`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.cancel).toBe(true);
  });

  it('GET /logs → admin can see all activity logs', async () => {
    const res = await request(app.getHttpServer())
      .get('/logs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const types = res.body.map((l) => l.type);

    expect(types).toEqual(
      expect.arrayContaining([
        'VEHICLE_ENTRY',
        'VEHICLE_EXIT',
        'RESERVATION_CANCELLED',
      ]),
    );
  });
});
