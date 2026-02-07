import { IsIn, IsOptional, IsString } from "class-validator";

export class ListFilesQuery {
  @IsOptional()
  @IsIn(["personal", "team"])
  scope?: "personal" | "team";

  @IsOptional()
  @IsIn(["true", "false"])
  includeTrashed?: "true" | "false";

  @IsOptional()
  @IsIn(["true", "false"])
  favoritesOnly?: "true" | "false";

  @IsOptional()
  @IsString()
  teamId?: string;
}

