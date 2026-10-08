import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class KitchenTicketActionDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

}

export class CompleteKitchenTicketActionDto extends KitchenTicketActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  recipientName?: string;
}

export class CancelKitchenTicketActionDto extends KitchenTicketActionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  reasonCode?: string;
}
