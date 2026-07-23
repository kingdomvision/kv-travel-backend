import { IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class RefreshDto {
  /** Optional when refresh token is sent via httpOnly cookie. */
  @IsOptional()
  @ValidateIf((_, v) => v !== undefined && v !== null && v !== '')
  @IsString()
  @MinLength(20)
  refreshToken?: string;
}
