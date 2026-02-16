import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import {
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class AiMessageDto {
  @ApiProperty({
    enum: ["user", "assistant"],
    example: "user",
  })
  @IsString()
  @IsIn(["user", "assistant"])
  role!: "user" | "assistant";

  @ApiProperty({
    example: "Draw an architecture diagram with API gateway and two services.",
  })
  @IsString()
  @MaxLength(10_000)
  content!: string;
}

export class TextToDiagramDto {
  @ApiProperty({
    type: [AiMessageDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiMessageDto)
  messages!: AiMessageDto[];
}
