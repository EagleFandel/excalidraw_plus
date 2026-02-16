import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";

import type {
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";

type FollowPayload = {
  userToFollow?: {
    socketId?: string;
  };
  action?: "FOLLOW" | "UNFOLLOW";
};

const ROOM_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

const parseRoomId = (value: unknown): string | null => {
  if (typeof value !== "string" || !ROOM_ID_REGEX.test(value)) {
    return null;
  }
  return value;
};

@WebSocketGateway({
  path: "/socket.io",
  cors: {
    origin: true,
    credentials: true,
  },
})
export class CollabGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CollabGateway.name);
  private readonly socketRoom = new Map<string, string>();
  private readonly targetFollowers = new Map<string, Set<string>>();
  private readonly followerTargets = new Map<string, Set<string>>();

  handleConnection(client: Socket) {
    client.emit("init-room");
  }

  handleDisconnect(client: Socket) {
    const roomId = this.socketRoom.get(client.id);
    if (roomId) {
      this.socketRoom.delete(client.id);
      this.emitRoomUsers(roomId);
    }

    const followedTargets = this.followerTargets.get(client.id);
    if (followedTargets) {
      for (const targetSocketId of followedTargets) {
        this.removeFollower(targetSocketId, client.id);
      }
      this.followerTargets.delete(client.id);
    }

    const followers = this.targetFollowers.get(client.id);
    if (followers) {
      for (const followerSocketId of followers) {
        const targets = this.followerTargets.get(followerSocketId);
        if (targets) {
          targets.delete(client.id);
          if (!targets.size) {
            this.followerTargets.delete(followerSocketId);
          }
        }
      }
      this.targetFollowers.delete(client.id);
      this.emitFollowRoomUsers(client.id);
    }
  }

  @SubscribeMessage("join-room")
  async onJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomIdRaw: unknown,
  ) {
    const roomId = parseRoomId(roomIdRaw);
    if (!roomId) {
      return;
    }

    const roomUsersBeforeJoin = this.getRoomUserIds(roomId);
    const isFirstInRoom = roomUsersBeforeJoin.length === 0;

    await client.join(roomId);
    this.socketRoom.set(client.id, roomId);

    if (isFirstInRoom) {
      client.emit("first-in-room");
    } else {
      client.to(roomId).emit("new-user", client.id);
    }

    this.emitRoomUsers(roomId);
  }

  @SubscribeMessage("server-broadcast")
  onBroadcast(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomIdRaw: unknown,
    encryptedData: unknown,
    iv: unknown,
  ) {
    const roomId = parseRoomId(roomIdRaw) || this.socketRoom.get(client.id);
    if (!roomId) {
      return;
    }

    client.to(roomId).emit("client-broadcast", encryptedData, iv);
  }

  @SubscribeMessage("server-volatile-broadcast")
  onVolatileBroadcast(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomIdRaw: unknown,
    encryptedData: unknown,
    iv: unknown,
  ) {
    const roomId =
      typeof roomIdRaw === "string"
        ? roomIdRaw
        : this.socketRoom.get(client.id);
    if (!roomId) {
      return;
    }

    client.volatile.to(roomId).emit("client-broadcast", encryptedData, iv);
  }

  @SubscribeMessage("user-follow")
  onUserFollow(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: FollowPayload,
  ) {
    const targetSocketId = payload?.userToFollow?.socketId;
    if (!targetSocketId || typeof targetSocketId !== "string") {
      return;
    }

    if (payload.action === "FOLLOW") {
      client.join(`follow@${targetSocketId}`);
      this.addFollower(targetSocketId, client.id);
      return;
    }

    if (payload.action === "UNFOLLOW") {
      client.leave(`follow@${targetSocketId}`);
      this.removeFollower(targetSocketId, client.id);
    }
  }

  private addFollower(targetSocketId: string, followerSocketId: string) {
    const followers =
      this.targetFollowers.get(targetSocketId) || new Set<string>();
    followers.add(followerSocketId);
    this.targetFollowers.set(targetSocketId, followers);

    const targets =
      this.followerTargets.get(followerSocketId) || new Set<string>();
    targets.add(targetSocketId);
    this.followerTargets.set(followerSocketId, targets);

    this.emitFollowRoomUsers(targetSocketId);
  }

  private removeFollower(targetSocketId: string, followerSocketId: string) {
    const followers = this.targetFollowers.get(targetSocketId);
    if (followers) {
      followers.delete(followerSocketId);
      if (!followers.size) {
        this.targetFollowers.delete(targetSocketId);
      }
    }

    const targets = this.followerTargets.get(followerSocketId);
    if (targets) {
      targets.delete(targetSocketId);
      if (!targets.size) {
        this.followerTargets.delete(followerSocketId);
      }
    }

    this.emitFollowRoomUsers(targetSocketId);
  }

  private emitFollowRoomUsers(targetSocketId: string) {
    const followers = [...(this.targetFollowers.get(targetSocketId) || [])];
    this.server
      .to(`follow@${targetSocketId}`)
      .emit("user-follow-room-change", followers);
  }

  private getRoomUserIds(roomId: string) {
    const room = this.server.sockets.adapter.rooms.get(roomId);
    if (!room) {
      return [];
    }
    return [...room.values()];
  }

  private emitRoomUsers(roomId: string) {
    const users = this.getRoomUserIds(roomId);
    this.server.to(roomId).emit("room-user-change", users);
    this.logger.debug(`room ${roomId} users: ${users.join(",")}`);
  }
}
