import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import * as bcrypt from 'bcrypt';

describe('Parking Occupancy (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let employeeToken: string;

  jest.setTimeout(300000);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    prisma = moduleFixture.get(PrismaService);

    await app.init();
  }, 300000);

  beforeEach(async () => {
    /**
     * 🧹 Limpiar BD
     */
    await prisma.reservation.deleteMany();
    await prisma.vehicle.deleteMany();
    await prisma.parkingSpot.deleteMany();
    await prisma.user.deleteMany();

    /**
     * 👷‍♂️ Crear empleado
     */
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password', salt);

    const employee = await prisma.user.create({
      data: {
        name: 'Empleado Test',
        email: 'employee@test.com',
        password: hashedPassword,
        role: 'empleado',
      },
    });

    /**
     * 🔐 Login empleado
     */
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'employee@test.com',
        password: 'password',
      });

    employeeToken = loginRes.body.access_token;

    /**
     * 🅿️ Crear plazas
     */
    await prisma.parkingSpot.createMany({
      data: [
        { code: 'A-01' },
        { code: 'A-02' },
      ],
    });

    /**
     * 🚗 Crear usuario cliente + vehículo
     */
    const user = await prisma.user.create({
      data: {
        name: 'Cliente Test',
        email: 'cliente@test.com',
        password: hashedPassword,
        role: 'cliente',
      },
    });

    const vehicle = await prisma.vehicle.create({
      data: {
        plate: 'TEST-123',
        userId: user.id,
      },
    });

    /**
     * ⏱ Crear reserva ACTIVA ahora mismo
     */
    const now = new Date();
    const start = new Date(now.getTime() - 5 * 60 * 1000); // -5 min
    const end = new Date(now.getTime() + 60 * 60 * 1000); // +1h

    const spot = await prisma.parkingSpot.findFirst();

    if (!spot) {
    throw new Error('No parking spot found for test');
    }

    await prisma.reservation.create({
      data: {
        userId: user.id,
        vehicleId: vehicle.id,
        parkingSpotId: spot.id,
        startTime: start,
        endTime: end,
        cancel: false,
      },
    });
  }, 60000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('👷‍♂️ GET /parking-spots/stats/occupancy → should return current occupancy', async () => {
    const res = await request(app.getHttpServer())
      .get('/parking-spots/stats/occupancy')
      .set('Authorization', `Bearer ${employeeToken}`);

    /**
     * ✅ Status
     */
    expect(res.status).toBe(200);

    /**
     * ✅ Estructura general
     */
    expect(res.body).toHaveProperty('summary');
    expect(res.body).toHaveProperty('occupied');
    expect(res.body).toHaveProperty('free');

    /**
     * ✅ Summary
     */
    expect(res.body.summary).toEqual({
      totalSpots: 2,
      occupiedSpots: 1,
      freeSpots: 1,
      occupancyPercentage: 50,
    });

    /**
     * ✅ Ocupadas
     */
    expect(res.body.occupied).toHaveLength(1);
    expect(res.body.occupied[0]).toMatchObject({
      spotCode: 'A-01',
      vehicle: {
        plate: 'TEST-123',
      },
      user: {
        email: 'cliente@test.com',
      },
    });

    /**
     * ✅ Libres
     */
    expect(res.body.free).toHaveLength(1);
    expect(res.body.free[0].code).toBe('A-02');
  });
});
