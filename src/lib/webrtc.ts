import { io, type Socket } from "socket.io-client";

// export class WebRTCConnection {
//     deviceStream?: MediaStream;
//     connection: RTCPeerConnection
//     wssConnection: Socket
//     roomId?: string;
//     connectedToRoom?: boolean
    
//     // Initialize all necessary operations durning crating of new class instance and assign its results to it
//     constructor(forOtherDeviceStream: MediaStream, deviceStream: MediaStream) {
//         this.deviceStream = deviceStream;
//         this.connection = new RTCPeerConnection({
//             iceServers: [
//                 { urls: "stun:stun4.4.google.com:19302" }
//             ]
//         });
//         this.wssConnection = io("http://localhost:8080");

//         // Send across singaling server our candidature for other peer in order to create connection between peers!
//         // Handled each time when has been user ".setLocalDescription()" method
//         this.connection.onicecandidate = ({ candidate }) => {
//             if (candidate) {
//                 this.wssConnection.emit("ice-candidate", this.roomId, JSON.stringify(candidate));
//             }
//         }

//         // Add demanding candidates to our connection after recive event from socket.io signaling server
//         this.wssConnection.on("new-ice-candidate", (candidate: string) => {
//             if (this.connection.remoteDescription) {
//                 const candidateParsed = JSON.parse(candidate as string) as RTCIceCandidateInit;
    
//                 this.connection.addIceCandidate(candidateParsed);
//             }
//         });

//         // Attach stream recived from remote peer to video element
//         this.connection.ontrack = ({ streams }) => {
//             streams[0].getTracks().forEach(track => {
//                 forOtherDeviceStream.addTrack(track);
//             });
//         }
//     }

//     /** Create room and initialize all data required to create call using WebRTC HTML5 technology! */
//     public async createCall() {
//         // Add video track to stream WebRTC
//         this.addVideoAndAudioStreamToCall();

//         // Create room for signaling between two connection partners or more then two
//         await this.createSignalingRoom();

//         // Create offer and setup local description
//         const offer = await this.connection.createOffer();
//         await this.connection.setLocalDescription(offer);

//         // listen for answer and setup answer remote description as description
//         this.wssConnection.on("answer", async (answer: string) => {
//             // Parse "answer" from JSON object to plain JavaScript or when you prefer to said for that POJO
//             answer = JSON.parse(answer);

//             // Set received answer as remote description for created Peer-to-Peer connection
//             await this.connection.setRemoteDescription(answer as any);
//         });
        
//         // Call to signaling server sending offer (delay is for waiting to recive and set created room identifier as this class "roomId" property using which syntax: "this.roomId" we can get access to room identifier)
//         setTimeout(async () => {
//             await this.signalingChannelSend(offer)
//         }, 1_000)
        
//         // Return offer
//         return offer;
//     }
    
//     /** Join client to existing room which has been created prior! */
//     public async joinToCall(roomId: string) {
//         // Add video track to stream WebRTC
//         this.addVideoAndAudioStreamToCall();

//         // Emit demand join to specific room to make RTC signaling calls
//         this.wssConnection.emit("join-to-room-demand", roomId, (result: boolean) => {
//             // Global connection to room status (global in context of enclosing class instance)
//             this.connectedToRoom = result;

//             // Handle "join to room" operation results sended back from signaling server
//             if (result) {
//                 // Assign room id to local class property
//                 this.roomId = roomId;

//                 // Emit event signaling that user connect to room which exists
//                 const ev = new CustomEvent("joined-to-room", { detail: roomId });
//                 window.dispatchEvent(ev);

//                 // Get "offer" from room and create and send "answer"
//                 this.wssConnection.emit("get-part-of-room", "offer", this.roomId, async (status: boolean, offer: any) => {
//                     if (status) {
//                         // Parse "offer" object from JSON (JSON object is the default value) to POJO in JavaScript
//                         offer = JSON.parse(offer);

//                         // Set description from offer
//                         await this.connection.setRemoteDescription(new RTCSessionDescription(offer));
    
//                         // Create and send answer by signaling server to second user or to other users and also set local-description for this peer
//                         const answer = await this.connection.createAnswer();
//                         const _ldesc = await this.connection.setLocalDescription(answer);
//                         await this.signalingChannelSend(answer);
//                     } else alert("Couldn't get offer created by another peer from that room!")
//                 });
//             }
//             else {
//                 // Emit event signaling that user can't join to room becuase it doesn't exists
//                 const ev = new CustomEvent("room-doesnt-exist");
//                 window.dispatchEvent(ev);
//             }
//         });
//     }

//     public async createSignalingRoom() {
//         this.wssConnection.emit("create-room-demand", (roomId: string) => {
//             // Assign room identifier and success room creation status to class instance properties
//             this.roomId = roomId;
//             this.connectedToRoom = true;

//             // Emit global event that room has been created. To "detail" property is assigned created room identifier
//             const event = new CustomEvent("roomcreated", { detail: roomId });
//             window.dispatchEvent(event);
//         });
//     }

//     private async signalingChannelSend(toSend: Object) {
//         this.wssConnection.emit("message", JSON.stringify(toSend), this.roomId)
//     }

//     private async addVideoAndAudioStreamToCall() {
//         // Add stream to call only when it exists
//         if (this.deviceStream) {
//             // Add video to RTCPeerConnection class instance
//             for (const track of this.deviceStream.getTracks()) {
//                 this.connection.addTrack(track, this.deviceStream)
//             }
//         }
//     }
// }

type RoomIdentifier = string;
export class WebRTCConnection {
    wssConnection: Socket
    roomId?: string;
    connectedToRoom?: boolean
    
    // Initialize all necessary operations durning crating of new class instance and assign its results to it
    constructor() {
        this.wssConnection = io("http://localhost:8080");
    }

    public async createSignalingRoom(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.wssConnection.emit("create-room-demand", (roomId: string) => {
                // Assign room identifier and success room creation status to class instance properties
                this.roomId = roomId;
                this.connectedToRoom = true;
    
                // Emit global event that room has been created. To "detail" property is assigned created room identifier
                const event = new CustomEvent("roomcreated", { detail: roomId });
                window.dispatchEvent(event);

                // Return success as a promise worked result
                resolve()
            });
        })
    }

    public signalingChannelSendMessage(toSend: Object) {
        this.wssConnection.emit("message", JSON.stringify(toSend), this.roomId)
    }

    public signalingChannelSendIceCandidate(candidate: RTCIceCandidate) {
        this.wssConnection.emit("ice-candidate", this.roomId, JSON.stringify(candidate));
    }

    /** Return promise with array arised by candidates from room to which user is joining */
    public async getIceCandidatesFromRoom(): Promise<string[]> {
        return new Promise((resolve, reject) => {
            this.wssConnection.emit("get-room-ice-candidates", this.roomId, (candidates: string[]) => {
                resolve(candidates);
            });
        });
    }

    public async signalingChannelEmitJoinToRoomRequest(roomId: RoomIdentifier): Promise<void> {
        return new Promise((resolve, reject) => {
            this.wssConnection.emit("join-to-room-demand", roomId, (result: boolean) => {
                this.connectedToRoom = result;

                // Do appropriate action to result of joining to room
                if (result) {
                    this.roomId = roomId;

                    // Emit that user join to room with roomId to which user join assigned as room identifier
                    const e = new CustomEvent("joined-to-room", { detail: roomId });
                    window.dispatchEvent(e);

                    // Emit success from promise
                    resolve(undefined);
                }
                else {
                    // When could not join to room emit appropriate event to such action
                    const e = new Event("can't-join-to-room");
                    window.dispatchEvent(e);
                    
                    // Return "rejection" from promise
                    reject("room-doesn't-exists");
                }
            });
        })
    }

    public async signalingChannelGetOffer(): Promise<RTCSessionDescriptionInit> {
        return new Promise((resolve, reject) => {
            this.wssConnection.emit("get-part-of-room", "offer", this.roomId, async (status: boolean, offer: string) => {
                // Do appropriate action to recived status
                if (status) {
                    offer = JSON.parse(offer);

                    // Return offer as "fulfilled" promise result
                    resolve((offer as unknown) as RTCSessionDescriptionInit);
                } 
                else reject(undefined); // Return "rejection" as promise working status
            });
        })
    }
}


