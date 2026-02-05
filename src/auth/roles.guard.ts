import {
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1️⃣ Obtener los roles requeridos del endpoint o del controller
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      'roles',
      [context.getHandler(), context.getClass()],
    );

    // 2️⃣ Si no hay roles definidos, dejar pasar
    if (!requiredRoles) {
      return true;
    }

    // 3️⃣ Obtener el usuario que puso JwtStrategy en req.user
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 4️⃣ Validar que el usuario tenga un rol permitido
    return requiredRoles.includes(user.role);
  }
}
