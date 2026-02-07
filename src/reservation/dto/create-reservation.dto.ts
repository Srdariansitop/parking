import { IsDateString, IsInt } from 'class-validator';

export class CreateReservationDto {
  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsInt()
  vehicleId: number;
}
