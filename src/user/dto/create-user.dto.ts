// src/users/dto/create-user.dto.ts
import { IsEmail, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export enum Role {
  admin = 'admin',
  empleado = 'empleado',
  cliente = 'cliente',
}

export class CreateUserDto {
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
