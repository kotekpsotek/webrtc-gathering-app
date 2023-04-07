<script lang="ts" async>
    import { onMount } from "svelte";
    import { WebRTCConnection } from "$lib/webrtc";

    // Configuration for established RTC connection
    const connectionConf = {
        iceServers: [
            { urls: "stun:stun.1.google.com:19302" }
        ]
    };

    // HTML element is assigned to this element after application load
    let videoElementPreview: HTMLVideoElement;
    let videoElementAnotherUser: HTMLVideoElement;
    let signalingRoomId: string = "not specified";

    // Whether Another user is connected with this device peer
    let userAnotherIsConnected = false;

    // Stream from local device
    let localDeviceStream: MediaStream;

    // Id from input to join to specified room id
    let roomID: string = ""; 

    // Things which will be performing on client side
    onMount(async () => {
        window.addEventListener("roomcreated", ({ detail }: any) => {
            console.log("Room has been created!")
            signalingRoomId = detail;
        });

        window.addEventListener("joined-to-room", ({ detail }: any) => {
            console.log("Joined to room!");
            signalingRoomId = detail;
        });

        window.addEventListener("room-doesn't-exists", () => {
            console.log("Could not join to room!");
            roomID = "";
            signalingRoomId = "not specified";
        });

        // Get stream and assign it to video element
        localDeviceStream = await getStream();
        videoElementPreview.srcObject = localDeviceStream;
    });

    async function getStream() {
        // Get stream from camera
        if (!navigator.mediaDevices) {
            alert("Your camera and microphone isn't avaiable!")
        }
        
        return await navigator.mediaDevices.getUserMedia({ video: true });
    } 

    // Create Room by click on button to create room
    async function createRoom(ev: Event) {
        // WebRTC channel connection
        const webRTCInstance = new WebRTCConnection();

        // Firstly create RTC signaling channel
        await webRTCInstance.createSignalingRoom();

        // Connection instance
        const connection = new RTCPeerConnection(connectionConf);

        // Add video track to stream
        localDeviceStream.getTracks().forEach(track => connection.addTrack(track, localDeviceStream));

        // When .localDescription property has been setup on connection then send iceCandidate of this connection to signaling server channel in order to pass forward to another peers
        connection.addEventListener("icecandidate", ({ candidate }) => {
            if (candidate) {
                console.log("ice candidate has been setup and send to signaling channel.\nIce candidate is: ", JSON.stringify(candidate))
                webRTCInstance.signalingChannelSendIceCandidate(candidate);
            }
        });

        // Add track from remote stream to preview of remote user
        connection.addEventListener("track", ({ streams }) => {
            userAnotherIsConnected = true;

            setTimeout(() => {
                videoElementAnotherUser.srcObject = streams[0];
            })
        });

        // Listening for ice-candidate from another peer passing throught signaling channel
        webRTCInstance.wssConnection.on("new-ice-candidate", (candidate: string) => {
            candidate = JSON.parse(candidate);
            userAnotherIsConnected = true;

            connection.addIceCandidate()
                .then(() => console.log("IceCandidate has been added to connection!"))
        })

        // Listening for answer from signaling server and setup it as remoteDescription property on RTC connection 
        webRTCInstance.wssConnection.on("answer", async (answer: string) => {
            answer = JSON.parse(answer);
            await connection.setRemoteDescription(answer as any)
        });

        // Setup offer and assign is to connection as localDescription property
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);

        // Send offer across signaling server
        webRTCInstance.signalingChannelSendMessage(offer)
    }

    async function joinToRoom(ev: Event) {
        // WebRTC channel connection
        const webRTCInstance = new WebRTCConnection();

        // Firstly join to signaling channel  
        await webRTCInstance.signalingChannelEmitJoinToRoomRequest(roomID);

        // Connection instance
        const connection = new RTCPeerConnection(connectionConf);

        // List with information about this user candidatures
        let thisCandidates: string[] = [];

        // Add video track to stream
        localDeviceStream.getTracks()
            .forEach(track => connection.addTrack(track, localDeviceStream));

        // When .localDescription property has been setup on connection then send iceCandidate of this connection to signaling server channel in order to pass forward to another peers
        connection.addEventListener("icecandidate", ({ candidate }) => {
            if (candidate) {
                console.log("ice candidate has been setup and send to signaling channel.\nIce candidate is: ", JSON.stringify(candidate))
                thisCandidates.push(JSON.stringify(candidate));
                webRTCInstance.signalingChannelSendIceCandidate(candidate);
            }
        });

        // Add track from remote stream to preview of remote user
        connection.addEventListener("track", ({ streams }) => {
            userAnotherIsConnected = true;

            setTimeout(() => {
                videoElementAnotherUser.srcObject = streams[0];
            })
        });

        // Listening for ice-candidate from another peer passing throught signaling channel
        webRTCInstance.wssConnection.on("new-ice-candidate", (candidate: string) => {
            candidate = JSON.parse(candidate);
            userAnotherIsConnected = true;

            connection.addIceCandidate()
                .then(() => console.log("IceCandidate has been added to connection!"))
        })

        // Get offer from signaling channel
        const offer = await webRTCInstance.signalingChannelGetOffer();
        await connection.setRemoteDescription(offer);

        // Add remaining candidates from signaling room to this client RTC connection instance
        (await webRTCInstance.getIceCandidatesFromRoom())
            .forEach(candidateRawString => {
                if (!thisCandidates.includes(candidateRawString)) {                    
                    console.log("Remaining ICE candidate has been added to this client connection!")
                    const candidate = JSON.parse(candidateRawString) as RTCIceCandidate;
                    connection.addIceCandidate(candidate);
                }
            });

        // Create answer and setup it as localDescription property
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);

        // Send answer to signaling channel
        webRTCInstance.signalingChannelSendMessage(answer);
    }

    // Test suite
    /* onMount(() => {
        // Test #1
        const cn1 = new RTCPeerConnection();
        const cn2 = new RTCPeerConnection();
    
        cn2.addEventListener("connectionstatechange", (ev) => {
            console.log(cn2.connectionState)
        })

        cn1.addEventListener("icecandidate", ({ candidate }) => {
            if (candidate) {
                cn2.addIceCandidate(candidate)
            }
        });
    
        cn2.addEventListener("icecandidate", ({ candidate }) => {
            if (candidate) {
                cn1.addIceCandidate(candidate)
            }
        });
    
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(localStream => {
                videoElementPreview.srcObject = localStream;
    
                localStream.getTracks().forEach(track => {
                    cn1.addTrack(track);
                });
    
                return cn1.createOffer();
            })
            .then(offer => cn1.setLocalDescription(new RTCSessionDescription(offer)))
            .then(() => cn2.setRemoteDescription(cn1.localDescription as any))
            .then(() => cn2.createAnswer())
            .then(answer => cn2.setLocalDescription(new RTCSessionDescription(answer)))
            .then(() => cn1.setRemoteDescription(cn2.localDescription as any))

            cn2.ontrack = ({ streams }) => {
                videoElementAnotherUser.srcObject = streams[0]
                console.log("track recived")
            }
    }) */
</script>

<div class="videos">
    <div class="your-view">
        <div class="label your-stream">
            <p>Your preview</p>
        </div>
        <!-- svelte-ignore a11y-media-has-caption -->
        <video autoplay src="" bind:this={videoElementPreview}></video>
    </div>
    <div class="another-user-view" data-connected="false">
        {#if userAnotherIsConnected}
            <div class="label another-user-stream">
                <p>Another user preview</p>
            </div>
            <!-- svelte-ignore a11y-media-has-caption -->
            <video autoplay src="" bind:this={videoElementAnotherUser}></video>
        {:else}
            <div class="not-connected">
                <p>No one user is connected!</p>
            </div>
        {/if}
    </div>
</div>

<div class="room-id">
    <p>Your room id: </p>
    <p>{signalingRoomId}</p>
</div>

<div class="choose-bar">
    <div class="cl1">
        <input type="text" placeholder="ROOM ID" bind:value={roomID}>
        <button on:click={joinToRoom}>Join to room</button>
    </div>
    <div class="cl2">
        <button on:click={createRoom}>Create room</button>
    </div>
</div>

<style>
    * {
        margin: 0px;
        padding: 0px;
    }

    .videos {
        display: grid;
        grid-template-columns: 50% 50%;
        grid-template-rows: auto;
        gap: 10px;
    }

    .videos > div {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        background-color: black;
    }

    .videos > div > video {
        width: 100%;
        height: 100%;
    }

    .videos > div > div.not-connected {
        width: 50%;
        height: 25%;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: rgba(255, 255, 255, 0.718);
    }

    .videos div > div.label {
        padding: 5px;
        position: absolute;
        top: 0px;
        left: 0px;
    }

    .videos div > div.label[class*="your"] {
        background-color: rgba(95, 158, 160, 0.8);
        color: white;
    }

    .videos div > div.label[class*="another"] {
        background-color: rgb(218, 84, 102, 0.8);
        color: white;
    }

    .room-id, .choose-bar {
        margin-top: 10px;
    }

    .room-id {
        display: flex;
        gap: 5px;
    }
</style>