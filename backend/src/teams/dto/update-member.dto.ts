import { IsIn } from "class-validator";

export class UpdateMemberDto {
  @IsIn(["owner", "admin", "member"])
  role!: "owner" | "admin" | "member";
}

