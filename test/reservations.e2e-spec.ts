import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import * as bcrypt from 'bcrypt'; 

describe('Reservations (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: number;
  let vehicleId: number;
  let parkingSpotId: number;

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
    //Limpiar BD
    await prisma.reservation.deleteMany();
    await prisma.vehicle.deleteMany();
    await prisma.parkingSpot.deleteMany();
    await prisma.user.deleteMany();

    //Hash para el login
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password', salt);

    //Crear usuario
    const user = await prisma.user.create({
      data: {
        name: 'Cliente Test',
        email: 'cliente@test.com',
        password: hashedPassword,
        role: 'cliente',
      },
    });
    userId = user.id as any; 

    //Crear vehículo
    const vehicle = await prisma.vehicle.create({
      data: {
        plate: 'TEST-123',
        userId: userId, 
      },
    });
    vehicleId = vehicle.id as any;

    //Crear plaza
    const spot = await prisma.parkingSpot.create({
      data: {
        code: 'A-01',
      },
    });
    parkingSpotId = spot.id as any;

    //Login
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'cliente@test.com',
        password: 'password',
      });

    token = loginRes.body.access_token;
  }, 60000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });
  //Crear una reserva correctamente
  it('POST /reservations → should reserve a parking spot', async () => {
    const start = new Date();
    start.setHours(start.getHours() + 1);
    const end = new Date();
    end.setHours(end.getHours() + 2);

    const res = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vehicleId, // 👈 Usamos el ID guardado
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      });

    if (res.status !== 201) {
        console.log('Error Body:', res.body);
    }

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });
  // Creamos una reserva que ocupa la única plaza disponible y luego intentamos crear otra reserva en el mismo horario
it('❌ should fail if no parking spots are available', async () => {
  // Crear segundo vehículo del mismo usuario
  const secondVehicle = await prisma.vehicle.create({
    data: {
      plate: 'TEST-456',
      userId,
    },
  });

  const start = new Date();
  start.setHours(start.getHours() + 1);
  const end = new Date();
  end.setHours(end.getHours() + 2);

  // Primera reserva ocupa la única plaza
  await request(app.getHttpServer())
    .post('/reservations')
    .set('Authorization', `Bearer ${token}`)
    .send({
      vehicleId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    });

  // Segunda reserva con OTRO vehículo, mismo horario
  const res = await request(app.getHttpServer())
    .post('/reservations')
    .set('Authorization', `Bearer ${token}`)
    .send({
      vehicleId: secondVehicle.id,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    });

  expect(res.status).toBe(400);
  expect(res.body.message).toContain('No hay plazas disponibles');
});

// Crear otro usuario y vehículo, e intentar reservar con otro vehículo q no pertenece al usuario autenticado
  it('❌ should fail if vehicle does not belong to the user', async () => {
    
    const otherUser = await prisma.user.create({
      data: {
        name: 'Otro Usuario',
        email: 'otro@test.com',
        password: 'password',
        role: 'cliente',
      },
    });

    // Vehículo de otro usuario
    const otherVehicle = await prisma.vehicle.create({
      data: {
        plate: 'OTRO-999',
        userId: otherUser.id,
      },
    });

    const start = new Date();
    start.setHours(start.getHours() + 1);
    const end = new Date();
    end.setHours(end.getHours() + 2);

    const res = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vehicleId: otherVehicle.id,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain(
      'El vehículo no pertenece al usuario autenticado',
    );
  });
// Primera reserva y reserva solapada para el mismo vehículo
  it('❌ should fail if vehicle has overlapping reservation', async () => {
    const start1 = new Date();
    start1.setHours(start1.getHours() + 1);
    const end1 = new Date();
    end1.setHours(end1.getHours() + 3);

    
    await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vehicleId,
        startTime: start1.toISOString(),
        endTime: end1.toISOString(),
      });

    // Reserva solapada
    const start2 = new Date();
    start2.setHours(start2.getHours() + 2);
    const end2 = new Date();
    end2.setHours(end2.getHours() + 4);

    const res = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vehicleId,
        startTime: start2.toISOString(),
        endTime: end2.toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain(
      'El vehículo ya tiene una reserva en ese horario',
    );
  });
});