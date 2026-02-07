import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

import { FileSceneDto } from "./file-scene.dto";

export class CreateFileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsIn(["personal", "team"])
  scope?: "personal" | "team";

  @IsOptional()
  @IsString()
  @MinLength(1)
  teamId?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => FileSceneDto)
  scene?: FileSceneDto;
}

