import { Injectable } from "@nestjs/common";

import type { PrismaService } from "../prisma/prisma.service";

import type { User } from "@prisma/client";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    const exactMatch = await this.prisma.user.findUnique({
      where: { email },
    });
    if (exactMatch) {
      return exactMatch;
    }

    return this.prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  createUser(data: {
    email: string;
    passwordHash: string;
    displayName?: string | null;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        displayName: data.displayName ?? null,
      },
    });
  }
}
