<script lang="ts" async>
    import { onMount } from "svelte";
    import { WebRTCConnection } from "$lib/webrtc";
    import { userData } from "$lib/storages";

    // HTML element is assigned to this element after application load
    let videoElementPreview: HTMLVideoElement;
    let videoElementAnotherUser: HTMLVideoElement;
    let signalingRoomId: string = "not specified"; // Room id which should be used with all API stuff

    // Whether Another user is connected with this device peer
    let userAnotherIsConnected = false;

    // Determine whether another camera is turned on
    let anotherUserCameraStatus: "on" | "off" = "on";

    // Stream from local device
    let localDeviceStream: MediaStream;

    // Id from input to join to specified room id (only for using to bind value from input to specify room identifier to which user would like to join)
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

        // Listen for changes in camera status for change performed by another user then this device user 
        rtcConnection.signalingChannelPortal.on("changed-camera-status", (byUserId: string, status: "on" | "off") => {
            if ($userData.userId != byUserId) {
                // Assign other user camera status to global state
                anotherUserCameraStatus = status;
                
                // Timeout is to allow Svelte reactivity to hide or show preview of another user html video element 
                setTimeout(() => {
                    // When camera is again on after turn it off by another user then assign to html preview video element another user preview
                    if (status == "on") {
                        const fstReciver = rtcConnection.rtcConnection.getReceivers().length ? rtcConnection.rtcConnection.getReceivers()[0] : null; // get first receiver from RTC connection recivers list

                        if (fstReciver) {
                            // Create stream and obtain track from receiver
                            const stream = new MediaStream();
                            const reciverTrack = fstReciver.track;
    
                            // Add receiver track to stream
                            stream.addTrack(reciverTrack);
    
                            // Assign stream to html video preview element
                            videoElementAnotherUser.srcObject = stream
                        }
                    } 
                })
            }
        });
        
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
        });
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
        // Turn camera on/off in same device and for other RTC connection peers
        await rtcConnection.cameraOnOff(signalingRoomId);

        // Assign camera preview from this device to this device camera preview
        if (rtcConnection.cameraTurnOnStatus == "on") {
            videoElementPreview.srcObject = rtcConnection.deviceStream;
        }

        // Action required to launch Svelte Reactivity
        rtcConnection = rtcConnection;
    }
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
            {#if anotherUserCameraStatus == "on"}
                <div class="label another-user-stream">
                    <p>Another user preview</p>
                </div>
                <!-- svelte-ignore a11y-media-has-caption -->
                <video autoplay src="" bind:this={videoElementAnotherUser}></video>
            {:else}
                <div class="user-camera-off">
                    <p>User camera is turned off</p>
                </div>
            {/if}
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
