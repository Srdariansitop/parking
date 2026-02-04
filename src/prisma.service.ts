import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
// Importamos el cliente generado
import { PrismaClient } from './generated/prisma/client'; 
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // 1. Creamos el Pool de la librería 'pg'
    const pool = new Pool({ 
      connectionString: process.env.DATABASE_URL 
    });

    // 2. Creamos el adaptador usando ese pool
    const adapter = new PrismaPg(pool);

    // 3. Pasamos el adaptador al constructor de PrismaClient
    super({ adapter });
  }

  async onModuleInit() {
    // Conectamos a la base de datos
    await this.$connect();
  }

  async onModuleDestroy() {
    // Cerramos la conexión al apagar la aplicación
    await this.$disconnect();
  }
}