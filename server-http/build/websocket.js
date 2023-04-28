"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const redis_1 = require("redis");
// Fullpath is used because then compiled to javascript file will be in other directory and more accurately in: "./build"
const nativeModule = require("C:/Users/micha/Desktop/project_2/vite-project/native-manners/index.node"); // importing of native module in TypeScript must look like here to compile TypeScript to JavaScript in eligable way
class RoomCandidates {
    client;
    roomId;
    key;
    constructor(client, roomId) {
        // Assign to class instance params values passed by client
        this.client = client;
        this.roomId = roomId;
        // Assign facilitation room key name for each class instance
        this.key = `room-candidates:${this.roomId}`;
    }
    async getRoomCandidates() {
        const candidatesLen = await this.client.LLEN(this.key);
        if (candidatesLen == 0)
            return [];
        // Return candidates list from database without user id to which each candidate object belongs to
        const candidatesList = await this.client.LRANGE(this.key, 0, candidatesLen); // Non prepatred candidates list obtained from database
        let readyList = nativeModule.split_candidates(candidatesList)[1]; // List with ready candidates
        return readyList;
    }
    /** Retrun list with unique ids of user which are in room */
    async getRoomUserIds() {
        const candidatesLen = await this.client.LLEN(this.key);
        if (candidatesLen == 0)
            return [];
        // Return candidates list from database without user id to which each candidate object belongs to
        const candidatesList = await this.client.LRANGE(this.key, 0, candidatesLen); // Non prepatred candidates list obtained from database
        const dbUserIds = nativeModule.split_candidates(candidatesList)[0];
        // List with user ids which are in room
        const userIdsList = [];
        // Add user ids to list with user ids
        dbUserIds.forEach(uuid => {
            // Add user id to identifiers list only when into it isn't already iterated user identifier
            if (!userIdsList.includes(uuid))
                userIdsList.push(uuid);
        });
        return userIdsList;
    }
    async addNewCandidate(candidate, userId) {
        const candidateKey = `${userId}:${candidate}`;
        return await this.client.LPUSH(this.key, candidateKey);
    }
    /** Remove one ice candidate specified by client Identifier datas from database key */
    async removeIceCandidate(userId) {
        const candidatesLen = await this.client.LLEN(this.key);
        const candidatesList = await this.client.LRANGE(this.key, 0, candidatesLen); // Candidates list obtained from database
        const [candidatesIds, candidatesRTCCandidate] = nativeModule.split_candidates(candidatesList); // Ids of users which
        const readyCandidates = [];
        for (let i = 0; i < candidatesLen; i++) {
            const uuid = candidatesIds[i];
            if (uuid != userId)
                readyCandidates.push(`${uuid}:${candidatesRTCCandidate[i]}`);
        }
        // Remove old list and insert new
        await this.client.DEL(this.key);
        await this.client.LPUSH(this.key, readyCandidates);
    }
    /** Remove whole candidates key (redis database) with all its datas */
    async removeCandidatesKey() {
        const delCount = await this.client.DEL(this.key);
        return delCount > 0;
    }
}
/** Generate unique user identifier v4 (uuidv4) for each user whose create new room or join to existing room */
function generateUserId() {
    return (0, crypto_1.randomUUID)();
}
async function main(socketInstance) {
    const redisClient = (0, redis_1.createClient)();
    await redisClient.connect();
    socketInstance.on("connection", socket => {
        // Create room for connections
        socket.on("create-room-demand", async (cb) => {
            // Generated room id
            const roomId = `crum:${(0, crypto_1.randomUUID)()}`;
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
        socket.on("join-to-room-demand", async (roomId, success) => {
            // Join only to room which exist (room which has been created prior using demand by call websocket event: "create-room-demand")
            if (await redisClient.exists(`room:${roomId}`)) {
                await socket.join(roomId);
                // Generate UUID
                const uuid = generateUserId();
                // Return callback with result of operation and user id
                success(true, uuid);
            }
            else
                success(false);
        });
        // Get specified information (specified by "type" param recived from client) from room data saved in database
        socket.on("get-part-of-room", async (type, roomId, cb) => {
            // Check whether room with specified by client in message identifier exists
            if (await redisClient.EXISTS(`room:${roomId}`)) {
                // Get offer from saved room data and send back to client success status with offer obtained from database or same failure status represented as "false" boolean value
                const offer = await redisClient.HGET(`room:${roomId}`, "offer");
                if (offer) {
                    // Send back offer as not parsed JSON object
                    cb(true, offer);
                }
                else
                    cb(false); // otherwise send failure status of operation back to socket.io client
            }
            else {
                // Send back failure status of operation
                cb(false);
            }
        });
        // Receive messages from clients
        socket.on("message", async (message, roomId) => {
            const messageDeserialized = JSON.parse(message);
            // Do specific action for both message types
            switch (messageDeserialized.type) {
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
            }
            ;
        });
        // Listen for new candidates and send it to another peers "sitting in room"
        socket.on("ice-candidate", async (roomId, userId, candidate) => {
            if (roomId) {
                // Add new candidate to room
                await new RoomCandidates(redisClient, roomId).addNewCandidate(candidate, userId);
                // Pass candidate forward to other peers in room
                socket.in(roomId).emit("new-ice-candidate", candidate);
            }
            else
                console.log("Room Identifier hasn't been attached to recived event!");
        });
        // Send to same user which emits this event list with other canidates gathered in same room
        socket.on("get-room-ice-candidates", async (roomId, cb) => {
            const candidatesFor = await new RoomCandidates(redisClient, roomId).getRoomCandidates();
            // Return list of candidates
            cb(candidatesFor);
        });
        // Change camera status for other peers connected in same room by forwarding same event to another websocket peers gathered in same room
        socket.on("changed-camera-status", (roomId, emittingUser, status) => {
            socket.in(roomId).emit("changed-camera-status", emittingUser, status);
        });
        // Handle user leaving RTC connection room
        socket.on("user-leave-room", async (roomId, userId, success) => {
            const candidatesManipulation = new RoomCandidates(redisClient, roomId);
            let isAnotherUserInRoom = (await candidatesManipulation.getRoomUserIds()).length > 1; // determine using boolean value whether into room are more users then one, after leave user from RTC connection room
            let userIsInRoom = false;
            // Check whether socket is in room with identifier which user would like leave
            for (const socketRoomId of socket.rooms) {
                if (socketRoomId == roomId) {
                    userIsInRoom = true;
                    break;
                }
            }
            ;
            // Leave user from room and delete all user data from room or room when leaving user is last user of room
            if (userIsInRoom) {
                socket.in(roomId).emit("user-leave-room", userId);
                socket.leave(roomId);
                // Perform specific action to that whether is some user in room with candidates
                if (isAnotherUserInRoom) {
                    // Delete only leaving user data from all database records depending on room
                    await candidatesManipulation.removeIceCandidate(userId);
                }
                else {
                    // Delete all data assigned with room from database
                    await candidatesManipulation.removeCandidatesKey();
                }
                // Return successfull status
                success(true);
            }
            else
                success(false);
        });
    });
}
exports.default = main;
