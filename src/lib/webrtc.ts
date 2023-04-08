import { io, type Socket } from "socket.io-client";

type RoomIdentifier = string;
class WebRTCSignalingChannel {
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

export class WebRTCConnection {
    rtcConnection: RTCPeerConnection;
    signalingChannel: WebRTCSignalingChannel;
    signalingChannelPortal: Socket;
    deviceStream: MediaStream;
    anotherUserIsConnected: boolean;

    constructor(localDeviceStream: MediaStream) {
        // WebRTC connection instance
        this.rtcConnection = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.1.google.com:19302" }
            ]
        });
        // Signaling channel class instance (to get methods wrapped over signaling channel)
        this.signalingChannel = new WebRTCSignalingChannel();
        // Instance of websocket connection to simply interact with signaling channel (to get access to websocket methods from signaling channel such as: event listeners, event emitters etc...)
        this.signalingChannelPortal = this.signalingChannel.wssConnection;
        // Assign device stream to this class instance property
        this.deviceStream = localDeviceStream;
        // Assign property which determine whether other user is connected with our peer
        this.anotherUserIsConnected = false;
    }

    /** Creating room for calls */
    /** Return when all happens correctly MediaStream object with another user stream (using which you can attach stream to video preview HTML element) */
    createRoom(): Promise<MediaStream> {
        return new Promise(async (resolve, reject) => {
            // Firstly create RTC signaling channel
            await this.signalingChannel.createSignalingRoom();
    
            // Add video track to stream
            this.deviceStream.getTracks().forEach(track => this.rtcConnection.addTrack(track, this.deviceStream));
    
            // When .localDescription property has been setup on connection then send iceCandidate of this connection to signaling server channel in order to pass forward to another peers
            this.rtcConnection.addEventListener("icecandidate", ({ candidate }) => {
                if (candidate) {
                    console.log("ice candidate has been setup and send to signaling channel.\nIce candidate is: ", JSON.stringify(candidate))
                    this.signalingChannel.signalingChannelSendIceCandidate(candidate);
                }
            });
    
            // Handle universal events
            this.universalEventsHandler(resolve);
    
            // Listening for answer from signaling server and setup it as remoteDescription property on RTC connection 
            this.signalingChannelPortal.on("answer", async (answer: string) => {
                answer = JSON.parse(answer);
                await this.rtcConnection.setRemoteDescription(answer as any)
            });
    
            // Setup offer and assign is to connection as localDescription property
            const offer = await this.rtcConnection.createOffer();
            await this.rtcConnection.setLocalDescription(offer);
    
            // Send offer across signaling server
            this.signalingChannel.signalingChannelSendMessage(offer)
        })
    }

    /** Join user to existing RTC connection */
    /** Function will return MediaStream object using which you can attach preview to HTML video element (but more accurately using HTMLVideoElement (which is type of video element) .srcObject property to assign to it stream with preview) */
    joinToRoom(roomId: string): Promise<MediaStream> {
        return new Promise(async (resolve, reject) => {
            // Firstly join to signaling channel  
            await this.signalingChannel.signalingChannelEmitJoinToRoomRequest(roomId);
    
            // List with information about this user candidatures
            let thisCandidates: string[] = [];
    
            // Add video track to stream
            this.deviceStream.getTracks()
                .forEach(track => this.rtcConnection.addTrack(track, this.deviceStream));
    
            // When .localDescription property has been setup on connection then send iceCandidate of this connection to signaling server channel in order to pass forward to another peers
            this.rtcConnection.addEventListener("icecandidate", ({ candidate }) => {
                if (candidate) {
                    console.log("ice candidate has been setup and send to signaling channel.\nIce candidate is: ", JSON.stringify(candidate))
                    thisCandidates.push(JSON.stringify(candidate));
                    this.signalingChannel.signalingChannelSendIceCandidate(candidate);
                }
            });
    
            // Handle universal events
            this.universalEventsHandler(resolve);
    
            // Get offer from signaling channel
            const offer = await this.signalingChannel.signalingChannelGetOffer();
            await this.rtcConnection.setRemoteDescription(offer);
    
            // Add remaining candidates from signaling room to this client RTC connection instance
            (await this.signalingChannel.getIceCandidatesFromRoom())
                .forEach(candidateRawString => {
                    if (!thisCandidates.includes(candidateRawString)) {                    
                        console.log("Remaining ICE candidate has been added to this client connection!")
                        const candidate = JSON.parse(candidateRawString) as RTCIceCandidate;
                        this.rtcConnection.addIceCandidate(candidate);
                    }
                });
    
            // Create answer and setup it as localDescription property
            const answer = await this.rtcConnection.createAnswer();
            await this.rtcConnection.setLocalDescription(answer);
    
            // Send answer to signaling channel
            this.signalingChannel.signalingChannelSendMessage(answer);
        });
    }

    /** Handle events which are same and are using in both cases: when user creating new RTC room, when user is joining to existing RTC room */
    private universalEventsHandler(promiseResolveFn: (result: any) => any) {
        // Add track from remote stream to preview of remote user
        this.rtcConnection.addEventListener("track", ({ streams }) => {
            this.anotherUserIsConnected = true;

            // Return user stream as a result of work this function and it whole operations
            promiseResolveFn(streams[0]);
        });

        // Listening for ice-candidate from another peer passing throught signaling channel
        this.signalingChannelPortal.on("new-ice-candidate", (candidate: string) => {
            candidate = JSON.parse(candidate);
            this.anotherUserIsConnected = true;

            this.rtcConnection.addIceCandidate()
                .then(() => console.log("IceCandidate has been added to connection!"))
        })
    }
}
