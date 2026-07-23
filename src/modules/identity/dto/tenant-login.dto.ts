import { IsEmail, IsOptional, IsString, IsUUID, MinLength, ValidateIf } from 'class-validator';

export class TenantDiscoverDto {
  @IsEmail()
  email!: string;
}

export class TenantLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  /** Preferred: select organization from discover step */
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  /** Legacy/internal: still accepted if tenantId not provided */
  @ValidateIf((o: TenantLoginDto) => !o.tenantId)
  @IsOptional()
  @IsString()
  tenantSlug?: string;
}
