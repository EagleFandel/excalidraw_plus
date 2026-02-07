import { IsBoolean } from "class-validator";

export class FavoriteDto {
  @IsBoolean()
  isFavorite!: boolean;
}

