import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { VehiclesModule } from './vehicle/vehicle.module';
import { ParkingSpotModule } from './parking-spot/parking-spot.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, 
    }),
    UsersModule,
    AuthModule,
    VehiclesModule,
    ParkingSpotModule,
  ],
})
export class AppModule {}