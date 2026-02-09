import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import * as bcrypt from 'bcrypt';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;
  let userId: number;

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

  await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@test.com',
      password: passwordHash,
      role: 'admin',
    },
  });

  const user = await prisma.user.create({
    data: {
      name: 'Usuario Original',
      email: 'user@test.com',
      password: passwordHash,
      role: 'cliente',
    },
  });

  userId = user.id;

  const adminLogin = await request(app.getHttpServer())
    .post('/auth/login')
    .send({
      email: 'admin@test.com',
      password: 'password',
    });

  adminToken = adminLogin.body.access_token;

  const userLogin = await request(app.getHttpServer())
    .post('/auth/login')
    .send({
      email: 'user@test.com',
      password: 'password',
    });

  userToken = userLogin.body.access_token;
});


  afterAll(async () => {
    await app.close();
  });

  // ADMIN ACTUALIZA USUARIO

  it('✅ should allow admin to update a user', async () => {
    const res = await request(app.getHttpServer())
      .put(`/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Usuario Actualizado',
        email: 'updated@test.com',
      });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Usuario Actualizado');
    expect(res.body.email).toBe('updated@test.com');
  });

  
  //  USUARIO SIN PERMISOS

  it('❌ should forbid non-admin user from updating a user', async () => {
    const res = await request(app.getHttpServer())
      .put(`/users/${userId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Hack',
      });

    expect(res.status).toBe(403);
  });

  //  USUARIO NO EXISTE
  
  it('❌ should return 404 if user does not exist', async () => {
    const res = await request(app.getHttpServer())
      .put('/users/99999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'No existe',
      });

    expect(res.status).toBe(404);
    expect(res.body.message).toContain('Usuario no encontrado');
  });
});
