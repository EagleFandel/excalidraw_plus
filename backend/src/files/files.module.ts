import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { TeamsModule } from "../teams/teams.module";

import { FilesController } from "./files.controller";
import { FilesService } from "./files.service";

@Module({
  imports: [AuthModule, TeamsModule],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}

