import { IsOptional, IsString } from 'class-validator';

export class UpdateParkingSpotDto {
  @IsOptional()
  @IsString()
  code?: string;
}
