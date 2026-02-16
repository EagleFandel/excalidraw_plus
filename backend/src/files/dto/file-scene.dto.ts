import { IsArray, IsObject, IsOptional, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class FileSceneDto {
  @ApiProperty({
    type: "array",
    description: "Excalidraw elements array",
  })
  @IsArray()
  elements!: unknown[];

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: true,
    description: "Excalidraw appState payload",
  })
  @IsOptional()
  @IsObject()
  appState?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: true,
    description: "Excalidraw binary files map",
  })
  @IsOptional()
  @IsObject()
  files?: Record<string, unknown>;
}

export class NestedSceneDto {
  @ApiProperty({
    type: () => FileSceneDto,
  })
  @ValidateNested()
  @Type(() => FileSceneDto)
  scene!: FileSceneDto;
}
