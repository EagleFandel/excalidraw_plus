import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class PutAssetDto {
  @ApiProperty({
    description: "Binary payload in base64 format",
    example: "AAABBBCCCDDDEEE...",
  })
  @IsString()
  @MinLength(8)
  @MaxLength(10_000_000)
  blob!: string;
}
