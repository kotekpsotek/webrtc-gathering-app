import { io, type Socket } from "socket.io-client";
import { userData } from "$lib/storages";

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
            this.wssConnection.emit("create-room-demand", (roomId: string, uuid: string) => {
                // Assign room identifier and success room creation status to class instance properties
                this.roomId = roomId;
                this.connectedToRoom = true;
    
                // Emit global event that room has been created. To "detail" property is assigned created room identifier
                const event = new CustomEvent("roomcreated", { detail: roomId });
                window.dispatchEvent(event);

                // Set user UUID obtained from server side
                userData.update(userData => {
                    userData.userId = uuid
                    return userData;
                });

                // Return success as a promise worked result
                resolve()
            });
        })
    }

    public signalingChannelSendMessage(toSend: Object) {
        this.wssConnection.emit("message", JSON.stringify(toSend), this.roomId)
    }

    public signalingChannelSendIceCandidate(candidate: RTCIceCandidate) {
        userData.update(uData => {
            this.wssConnection.emit("ice-candidate", this.roomId, uData.userId, JSON.stringify(candidate));
            return uData;
        })
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
            this.wssConnection.emit("join-to-room-demand", roomId, (result: boolean, uuid?: string ) => {
                this.connectedToRoom = result;

                // Do appropriate action to result of joining to room
                if (result) {
                    this.roomId = roomId;
                    
                    // Set user UUID obtained from server side
                    userData.update(userData => {
                        userData.userId = uuid as string;
                        return userData;
                    });
                    // in such environment conditions uuid is presented always

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
    rtpUserSender?: RTCRtpSender;
    cameraTurnOnStatus: "on" | "off";

    constructor(localDeviceStream: MediaStream) {
        // WebRTC connection instance
        this.rtcConnection = this.createRTCConnection();
        // Signaling channel class instance (to get methods wrapped over signaling channel)
        this.signalingChannel = new WebRTCSignalingChannel();
        // Instance of websocket connection to simply interact with signaling channel (to get access to websocket methods from signaling channel such as: event listeners, event emitters etc...)
        this.signalingChannelPortal = this.signalingChannel.wssConnection;
        // Assign device stream to this class instance property
        this.deviceStream = localDeviceStream;
        // Assign property which determine whether other user is connected with our peer
        this.anotherUserIsConnected = false;
        // Determine whether camera is turned on or not
        this.cameraTurnOnStatus = "on";
    }

    /** Create RTC connection for class usage */
    private createRTCConnection() {
        return new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.1.google.com:19302" }
            ]
        });
    }

    /** Creating room for calls */
    /** Return when all happens correctly MediaStream object with another user stream (using which you can attach stream to video preview HTML element) */
    createRoom(): Promise<MediaStream> {
        return new Promise(async (resolve, reject) => {
            // Firstly create RTC signaling channel
            await this.signalingChannel.createSignalingRoom();
    
            // Add video track to stream
            this.deviceStream.getTracks().forEach(track => this.rtpUserSender = this.rtcConnection.addTrack(track, this.deviceStream));
    
            // When .localDescription property has been setup on connection then send iceCandidate of this connection to signaling server channel in order to pass forward to another peers
            this.rtcConnection.addEventListener("icecandidate", ({ candidate }) => {
                if (candidate) {
                    const pCandidate = JSON.stringify(candidate);

                    // Assign user candidate object to user data Svelte storage
                    userData.update(data => {
                        data.userIceCandidate = pCandidate;
                        return data;
                    });

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
                .forEach(track => this.rtpUserSender = this.rtcConnection.addTrack(track, this.deviceStream));
    
            // When .localDescription property has been setup on connection then send iceCandidate of this connection to signaling server channel in order to pass forward to another peers
            this.rtcConnection.addEventListener("icecandidate", ({ candidate }) => {
                if (candidate) {
                    const pCandidate = JSON.stringify(candidate);

                    // Assign user candidate object to user data Svelte storage
                    userData.update(data => {
                        data.userIceCandidate = pCandidate;
                        return data;
                    });
                    
                    thisCandidates.push(pCandidate);
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

    /** Leave this device user from room to which it has been connected */
    leaveConnection(roomId: RoomIdentifier) {
        userData.update(data => {
            // Emit event to other room clients that this client leave room
            this.signalingChannelPortal.emit("user-leave-room", roomId, data.userId, (success: boolean) => {
                // Disconnect user only when it is allowed by server side
                if (success) {
                    // Close RTC connection
                    this.rtcConnection.close();

                    // Assign new RTC connection
                    this.rtcConnection = this.createRTCConnection();
                }
            });
            
            // Return not updated user data
            return data;
        })
    }

    /** Turn on/off camera on localDevice and for connected with this device another peers in same room */
    async cameraOnOff(roomId: RoomIdentifier) {      
        let stat = this.cameraTurnOnStatus; // :"on" or "off" always one from both

        if (stat == "on") { // Turn Off camera
            // After actions from this step other users without removing html video another user preview element will be see frozen last transmited video frame from this device
            // Stop video camera from playing videos
            this.deviceStream.getTracks()[0].stop();

            // Remove stream from RTC connection
            if (this.rtpUserSender) {
                this.rtcConnection.removeTrack(this.rtpUserSender);
            }

            // Set camera turned on status as "off" so camera isn't recording
            this.cameraTurnOnStatus = "off";

            // Emit event to user which is camera owner in local device call enviroment (browswer)
            const e = new CustomEvent("camera-status", { detail: "off" });
            window.dispatchEvent(e);
        } 
        else { // Turn On camera
            // Turn camera on again
            this.deviceStream = await this.getStream();
            
            // Add camera again to RTC streem connection
            const senders = this.rtcConnection.getSenders();
            if (senders.length) {
                const fstSender = senders[0];
                this.deviceStream.getTracks()
                    .forEach(async track => await fstSender.replaceTrack(track))
            }

            // Set camera turned on status as "on" so camera is now recording
            this.cameraTurnOnStatus = "on";

            // Emit event to user which is camera owner in local device call enviroment (browswer)
            const e = new CustomEvent("camera-status", { detail: "on" });
            window.dispatchEvent(e);
        }

        // Emit to other room clients that user change camera status to off/on
        userData.update(data => { // Get this client id from Svelte storage
            const uuid = data.userId;

            // Emit destination event
            this.signalingChannelPortal.emit("changed-camera-status", roomId, uuid, this.cameraTurnOnStatus);

            return data;
        });
    }

    /** Get access to stream from user mediaDevice camera */
    async getStream() {
        // Get stream from camera
        if (!navigator.mediaDevices) {
            alert("Your camera and microphone isn't avaiable!")
        }
        
        return await navigator.mediaDevices.getUserMedia({ video: true });
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

        // Listen that other user is leaving room
        this.signalingChannelPortal.on("user-leave-room", (uuid: string) => {
            this.anotherUserIsConnected = false;

            // Close existsing rtc connection and assign new to same class variable
            this.rtcConnection.close();
            this.rtcConnection = this.createRTCConnection();
        });
    }
}
