import { IsString, IsNotEmpty } from 'class-validator';

export class CreateParkingSpotDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}
