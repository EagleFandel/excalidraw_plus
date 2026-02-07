import {
  IsArray,
  IsObject,
  IsOptional,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class FileSceneDto {
  @IsArray()
  elements!: unknown[];

  @IsOptional()
  @IsObject()
  appState?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  files?: Record<string, unknown>;
}

export class NestedSceneDto {
  @ValidateNested()
  @Type(() => FileSceneDto)
  scene!: FileSceneDto;
}

