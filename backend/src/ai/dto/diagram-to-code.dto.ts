import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString, MaxLength } from "class-validator";

export class DiagramToCodeDto {
  @ApiProperty({
    type: [String],
    description: "Extracted texts from selected diagram elements",
  })
  @IsArray()
  @IsString({ each: true })
  texts!: string[];

  @ApiProperty({
    description: "Canvas snapshot Data URL",
  })
  @IsString()
  @MaxLength(10_000_000)
  image!: string;

  @ApiPropertyOptional({
    description: "Current editor theme",
    example: "light",
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  theme?: string;
}
