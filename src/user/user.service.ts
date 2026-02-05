import { Injectable,NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { User, Prisma, Role } from '../generated/prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async createUser(data: CreateUserDto): Promise<User> {
    // Hash de password
    const hashedPassword = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        role: data.role ?? Role.cliente, 
        password: hashedPassword,
      },
    });
  }

  async getUsers(): Promise<User[]> {
    return this.prisma.user.findMany();
  }

  async getUserById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

 async update(id: number, dto: UpdateUserDto) {
  // 1️⃣ Verificar que el usuario exista
  const user = await this.prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundException('Usuario no encontrado');
  }

  // 2️⃣ Actualizar los campos permitidos
  return this.prisma.user.update({
    where: { id },
    data: {
      ...dto,
    },
  });
}


  async deleteUser(id: number): Promise<User> {
    return this.prisma.user.delete({ where: { id } });
  }
}