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

        // Return candidates list from database without user id to which each candidate object belongs to
        const candidatesList = await this.client.LRANGE(this.key, 0, candidatesLen); // Non prepatred candidates list obtained from database
        let readyList: string[] = []; // Prepared candidates list returning from this function
        for (let id = 0; id < candidatesLen; id++) {
            let candidateSelected = candidatesList[id];

            // Delete user identifier from candidate, from db key
            const cSp = candidateSelected.split(":");
            cSp.splice(0, 1); // remove user id from candidate schema

            // Assign to returning candidate list new prepared candidate shema
            candidateSelected = cSp.join(":").trim();
            readyList.push(candidateSelected);
        }
        
        return readyList;
    }

    /** Retrun list with unique ids of user which are in room */
    async getRoomUserIds(): Promise<string[]> {
        const candidatesLen = await this.client.LLEN(this.key);
        
        if (candidatesLen == 0) return [];

        // Return candidates list from database without user id to which each candidate object belongs to
        const candidatesList = await this.client.LRANGE(this.key, 0, candidatesLen); // Non prepatred candidates list obtained from database

        // List with user ids which are in room
        const userIdsList: string[] = [];

        // Add user ids to list with user ids
        candidatesList.forEach(key => {
            const userId = key.split(":")[0];

            // Add user id to identifiers list only when into it isn't already iterated user identifier
            if (!userIdsList.includes(userId)) userIdsList.push(userId);
        });

        return userIdsList;
    }

    async addNewCandidate(candidate: string, userId: string): Promise<CandidatesLenFromRoom> {
        const candidateKey = `${userId}:${candidate}`;
        return await this.client.LPUSH(this.key, candidateKey)
    }

    /** Remove one ice candidate specified by client Identifier datas from database key */
    async removeIceCandidate(userId: string) {
        const candidatesLen = await this.client.LLEN(this.key);
        const candidatesList = await this.client.LRANGE(this.key, 0, candidatesLen); // Candidates list obtained from database

        const readyCandidates: string[] = [];
        for (const candidate of candidatesList) {
            const userCandidateId = candidate.split(":")[0];

            if (userCandidateId != userId) readyCandidates.push(candidate);
        }

        // Remove old list and insert new
        await this.client.DEL(this.key);
        await this.client.LPUSH(this.key, readyCandidates);
    }

    /** Remove whole candidates key (redis database) with all its datas */
    async removeCandidatesKey(): Promise<boolean> {
        const delCount = await this.client.DEL(this.key);
        return delCount > 0;
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
        socket.on("ice-candidate", async (roomId: string, userId: string, candidate: string) => {
            if (roomId) {
                // Add new candidate to room
                await new RoomCandidates(redisClient as any, roomId).addNewCandidate(candidate, userId);

                // Pass candidate forward to other peers in room
                socket.in(roomId).emit("new-ice-candidate", candidate)
            }
            else console.log("Room Identifier hasn't been attached to recived event!")
        });

        // Send to same user which emits this event list with other canidates gathered in same room
        socket.on("get-room-ice-candidates", async (roomId: string, cb) => {
            const candidatesFor = await new RoomCandidates(redisClient as any, roomId).getRoomCandidates();

            // Return list of candidates
            cb(candidatesFor)
        });

        // Change camera status for other peers connected in same room by forwarding same event to another websocket peers gathered in same room
        socket.on("changed-camera-status", (roomId: string, emittingUser: string, status: "on" | "off") => {
            socket.in(roomId).emit("changed-camera-status", emittingUser, status);
        });

        // Handle user leaving RTC connection room
        socket.on("user-leave-room", async (roomId: string, userId: string, success: (state: boolean) => void) => {
            const candidatesManipulation = new RoomCandidates(redisClient as any, roomId);
            let isAnotherUserInRoom = (await candidatesManipulation.getRoomUserIds()).length > 1; // determine using boolean value whether into room are more users then one, after leave user from RTC connection room
            let userIsInRoom = false; 
            
            // Check whether socket is in room with identifier which user would like leave
            for (const socketRoomId of socket.rooms) {
                if (socketRoomId == roomId) {
                    userIsInRoom = true;
                    break;
                } 
            };

            // Leave user from room and delete all user data from room or room when leaving user is last user of room
            if (userIsInRoom) {
                socket.in(roomId).emit("user-leave-room", userId);
                socket.leave(roomId);

                // Perform specific action to that whether is some user in room with candidates
                if (isAnotherUserInRoom) {
                    // Delete only leaving user data from all database records depending on room
                    await candidatesManipulation.removeIceCandidate(userId);
                } else {
                    // Delete all data assigned with room from database
                    await candidatesManipulation.removeCandidatesKey();
                }

                // Return successfull status
                success(true)
            }
            else success(false);
        });
    })
}
