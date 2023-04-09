<script lang="ts" async>
    import { onMount } from "svelte";
    import { WebRTCConnection } from "$lib/webrtc";

    // HTML element is assigned to this element after application load
    let videoElementPreview: HTMLVideoElement;
    let videoElementAnotherUser: HTMLVideoElement;
    let signalingRoomId: string = "not specified";

    // Whether Another user is connected with this device peer
    let userAnotherIsConnected = false;

    // Determine whether another camera is turned on
    let anotherUserCameraStatus: "on" | "off" = "on";

    // Stream from local device
    let localDeviceStream: MediaStream;

    // Id from input to join to specified room id
    let roomID: string = ""; 

    // Store class instance which handle RTC connections and devices using with RTC connection
    let rtcConnection: WebRTCConnection; 

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

        // Initialize class to perform RTC operations such as: joining to existing RTC connection, making new RTC connection room to allow other peers joining to that room
        rtcConnection = new WebRTCConnection(localDeviceStream);
        
        // Get stream and assign it to video element
        localDeviceStream = await rtcConnection.getStream();
        videoElementPreview.srcObject = localDeviceStream;
        rtcConnection.deviceStream = localDeviceStream;
    });

    // Create Room by click on button to create room
    async function createRoom(ev: Event) {
        // Operation of creation new RTC room is at all performing by specjalized for that class instance
        const stream = await rtcConnection.createRoom();

        // Assign to html video element preview of another peer from connection
        userAnotherIsConnected = rtcConnection.anotherUserIsConnected;
        setTimeout(() => {
            videoElementAnotherUser.srcObject = stream;
        })
    }

    // Join to room after click on "join to room" button
    async function joinToRoom(ev: Event) {
        // Operation of joining to existing RTC room connection (room which has been created prior time when we would like to join) is at all performing by specjalized for that class instance
        const stream = await rtcConnection.joinToRoom(roomID);

        // Assign to html video element preview of another peer from connection
        userAnotherIsConnected = rtcConnection.anotherUserIsConnected;
        setTimeout(() => {
            videoElementAnotherUser.srcObject = stream;
        });
    }

    // Change camera status to on/off after click on button to change camera status (camera status will be changed on this device and for another connected with this devices in same room peers)
    async function manageCameraOnAndOff(ev: Event) {
        await rtcConnection.cameraOnOff(roomID);

        if (rtcConnection.cameraTurnOnStatus == "on") {
            videoElementPreview.srcObject = rtcConnection.deviceStream;
        }

        // Action required to launch Svelte Reactivity
        rtcConnection = rtcConnection;
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

<button id="on-off-camera" on:click={manageCameraOnAndOff}>{rtcConnection?.cameraTurnOnStatus == "on" ? "Turn camera Off" : "Turn camera On"}</button>

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
