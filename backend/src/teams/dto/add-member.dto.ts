import { IsEmail, IsIn, IsOptional, IsString } from "class-validator";

export class AddMemberDto {
  @IsEmail()
  @IsString()
  email!: string;

  @IsOptional()
  @IsIn(["owner", "admin", "member"])
  role?: "owner" | "admin" | "member";
}

