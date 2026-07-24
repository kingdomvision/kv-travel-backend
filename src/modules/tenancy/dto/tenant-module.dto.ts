import { IsNotEmpty, IsUUID } from 'class-validator';

export class ChangeTenantPlanDto {
  @IsNotEmpty()
  @IsUUID()
  planId!: string;
}
