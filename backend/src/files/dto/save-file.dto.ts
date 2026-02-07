import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

import { FileSceneDto } from "./file-scene.dto";

export class SaveFileDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @ValidateNested()
  @Type(() => FileSceneDto)
  scene!: FileSceneDto;
}

