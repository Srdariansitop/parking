import { IsDateString, IsOptional } from 'class-validator';

export class UpdateReservationDto {
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;
}
