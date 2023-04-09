import type { Server } from "socket.io";
import { randomUUID } from "crypto";
import { RedisClientType, createClient } from "redis";

/** Manage candidates from room */
type CandidatesLenFromRoom = number;
class RoomCandidates {
    client: RedisClientType;
    roomId: string;
    key: string;

    constructor(client: RedisClientType, roomId: string) {
        // Assign to class instance params values passed by client
        this.client = client;
        this.roomId = roomId;

        // Assign facilitation room key name for each class instance
        this.key = `room-candidates:${this.roomId}`;
    }

    async getRoomCandidates(): Promise<string[]> {
        const candidatesLen = await this.client.LLEN(this.key);
        
        if (candidatesLen == 0) return [];
        
        return await this.client.LRANGE(this.key, 0, candidatesLen)
    }

    async addNewCandidate(candidate: string): Promise<CandidatesLenFromRoom> {
        return await this.client.LPUSH(this.key, candidate)
    }
}

/** Generate unique user identifier v4 (uuidv4) for each user whose create new room or join to existing room */
function generateUserId() {
    return randomUUID();
}

export default async function main(socketInstance: Server) {
    const redisClient = createClient();
    await redisClient.connect();
    
    socketInstance.on("connection", socket => {
        // Create room for connections
        socket.on("create-room-demand", async (cb) => {
            // Generated room id
            const roomId = `crum:${randomUUID()}`;

            // Generate UUID
            const uuid = generateUserId();

            // Create room into database
            await redisClient.HSET(`room:${roomId}`, "roomId", roomId);

            // Join client to this room
            await socket.join(roomId);
            
            // Send back to client it room id
            cb(roomId, uuid);
        });

        // Join socket to room specified by sended with demand room id. Send back to client join outcome (whether client join to signal channel)
        socket.on("join-to-room-demand", async (roomId: string, success) => {
            // Join only to room which exist (room which has been created prior using demand by call websocket event: "create-room-demand")
            if (await redisClient.exists(`room:${roomId}`)) {
                await socket.join(roomId);

                // Generate UUID
                const uuid = generateUserId();

                // Return callback with result of operation and user id
                success(true, uuid);
            }
            else success(false);
        });

        // Get specified information (specified by "type" param recived from client) from room data saved in database
        socket.on("get-part-of-room", async (type: "offer", roomId: string, cb) => {
            // Check whether room with specified by client in message identifier exists
            if (await redisClient.EXISTS(`room:${roomId}`)) {
                // Get offer from saved room data and send back to client success status with offer obtained from database or same failure status represented as "false" boolean value
                const offer = await redisClient.HGET(`room:${roomId}`, "offer");
                if (offer) {
                    // Send back offer as not parsed JSON object
                    cb(true, offer);
                }
                else cb(false); // otherwise send failure status of operation back to socket.io client
            } else {
                // Send back failure status of operation
                cb(false);
            }
        });
        
        // Receive messages from clients
        socket.on("message", async (message: string, roomId: string) => {
            const messageDeserialized: { type: "offer" | "answer" } = JSON.parse(message);

            // Do specific action for both message types
            switch(messageDeserialized.type) {
                case "offer":
                    // Save "offer" in database
                    await redisClient.HSET(`room:${roomId}`, "offer", message);

                    // Emit "offer" to other clients in room
                    socket.in(roomId).emit("offer", message);
                break;
                    
                case "answer":
                    // Save "answer" in database
                    await redisClient.HSET(`room:${roomId}`, "answer", message);

                    // Emit "answer" to other room clients
                    socket.in(roomId).emit("answer", message);
                break;
            };
        });

        // Listen for new candidates and send it to another peers "sitting in room"
        socket.on("ice-candidate", async (roomId: string, candidate: string) => {
            if (roomId) {
                // Add new candidate to room
                await new RoomCandidates(redisClient as any, roomId).addNewCandidate(candidate);

                // Pass candidate forward to other peers in room
                socket.in(roomId).emit("new-ice-candidate", candidate)
            }
            else console.log("Room Identifier hasn't been attached to recived event!")
        });


        socket.on("get-room-ice-candidates", async (roomId: string, cb) => {
            const candidatesFor = await new RoomCandidates(redisClient as any, roomId).getRoomCandidates();
            console.log(candidatesFor)

            // Return list of candidates
            cb(candidatesFor)
        });
    })
}
