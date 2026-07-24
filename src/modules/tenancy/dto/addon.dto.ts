import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AddonBillingCycle, TravelModule } from '../../../common/enums';

export class CreateAddonDto {
  @IsNotEmpty()
  @IsEnum(TravelModule)
  moduleCode!: TravelModule;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsInt()
  @Min(0)
  priceMonthly!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceYearly?: number;
}

export class UpdateAddonDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceMonthly?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceYearly?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class PurchaseAddonDto {
  @IsNotEmpty()
  @IsUUID()
  addonId!: string;

  @IsNotEmpty()
  @IsEnum(AddonBillingCycle)
  billingCycle!: AddonBillingCycle;
}
