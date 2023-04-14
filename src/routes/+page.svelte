<script lang="ts" async>
    import { onMount } from "svelte";
    import { WebRTCConnection } from "$lib/webrtc";
    import { userData } from "$lib/storages";
    import { VideoFilled, VideoOffFilled, PhoneOffFilled, PhoneFilled, PhoneVoiceFilled } from "carbon-icons-svelte"; // Import icons from great icons library
    import Chat from "$lib/fragments/Chat.svelte";

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

    // Message content from user to required send it
    let valueToSendMessageOnChat: string;

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

        // Listen when other user leave connections room
        rtcConnection.signalingChannelPortal.on("user-leave-room", (uuid: string) => {
            // Reset variables with states
            userAnotherIsConnected = false;
            anotherUserCameraStatus = "on";
            signalingRoomId = "not specified";
            roomID = "";

            // Create application visual aspects for leaving user event
            alert(`User ${uuid} leave connection room!`);
        });
        
        // Get stream and assign it to video element
        localDeviceStream = await rtcConnection.getStream();
        videoElementPreview.srcObject = localDeviceStream;
        rtcConnection.deviceStream = localDeviceStream;
    });

    // Create Room by click on button to create room
    async function createRoom(ev: Event) {
        // Replace existing RTC connection by new connection to reduce amount of savage throwbacks susceptabilities
        rtcConnection.assignNewConnection();
        
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
        // Replace existing RTC connection by new connection to reduce amount of savage throwbacks susceptabilities
        rtcConnection.assignNewConnection();
        
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

    // Leave room to which user has been connected
    async function leaveUserFromRTCConnection(ev: Event) {
        // Emit function to handle leaving user from connection room
        rtcConnection.leaveConnection(signalingRoomId);
        // Whether another user is connected with us
        userAnotherIsConnected = false;
        // Reset values stored by variables
        roomID = ""; // reset values from input to attach room identifier to join to it
        signalingRoomId = "not specified"; // reset value of room id used by whole WebRTC API
    }

    // Used when user send next message using existing room connection chat
    function userSendMessage({ detail }: CustomEvent) {

    }
</script>

<div class="room-actions">
    <div class="room-id">
        <p>Your room id: </p>
        <p id="source">{signalingRoomId}</p>
    </div>

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

    <div class="actions">
        <div class="zone">
            <button id="on-off-camera" on:click={manageCameraOnAndOff} class:turned-on={rtcConnection?.cameraTurnOnStatus == "on"}>
                {#if rtcConnection?.cameraTurnOnStatus == "on"}
                    <VideoOffFilled size={24} fill="white"/>
                {:else if rtcConnection?.cameraTurnOnStatus == "off"}
                    <VideoFilled size={24} fill="white"/>
                {/if}
            </button>
            {#if userAnotherIsConnected}
                <button id="leave-from-room" on:click={leaveUserFromRTCConnection}>
                    <PhoneOffFilled size={24} fill="white"/>
                </button>
            {/if}
        </div>
    </div>
</div>

{#if !userAnotherIsConnected}
    <div class="choose-bar">
        <h2>Connection manipulation stripe:</h2>
        <div class="cl1">
            <input type="text" placeholder="ROOM ID" bind:value={roomID}>
            <button on:click={joinToRoom}>
                <PhoneFilled size={20} fill="white"/>
            </button>
        </div>
        <div class="cl2">
            <button on:click={createRoom}>
                Create Connection
                <PhoneVoiceFilled size={20} fill="white"/>
            </button>
        </div>
    </div>
{:else}
    <Chat bind:value={valueToSendMessageOnChat} on:message-sended={userSendMessage}/>
{/if}

<style>
    * {
        margin: 0px;
        padding: 0px;
    }

    button {
        width: fit-content;
        border: none;
        outline: none;
        background-color: transparent;
        font-family: 'Roboto', sans-serif;
        font-size: 16px;
    }

    .room-actions {
        display: flex;
        flex-direction: column;
        gap: 5px;
        margin-top: 5px;
    }

    /* Room identifier */
    .room-id {
        height: 25px;
        width: fit-content;
        display: flex;
        align-items: center;
        padding: 5px;
        gap: 5px;
        background-color: rgb(50, 50, 50);
        border: solid 1px rgb(60, 60, 60);
        border-radius: 4px;
        color: white;
    }

    .room-id #source {
        color: red;
    }

    /* Videos container and videos elements */
    .videos {
        margin-bottom: 5px;
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

    /* Bar with buttons: turn off/on camera, leave with connections room (when any other user is connected with room) */
    div.actions {
        margin-top: 5px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    div.zone {
        width: 250px;
        padding: 5px;
        display: flex;
        align-items: center;
        justify-content: center;
        column-gap: 5px;
        background-color: rgb(50, 50, 50);
        border: solid 1px rgb(60, 60, 60);
        border-radius: 4px;
    }

    div.zone > button {
        width: 50px;
        height: 50px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: solid 2px white;
        border-radius: 50%;
        cursor: pointer;
    }

    button#on-off-camera {
        background-color: rgb(113, 113, 113);
    }

    button#on-off-camera.turned-on {
        background-color: red;
    }

    button#leave-from-room {
        background-color: black;
    }

    div.choose-bar {
        margin-top: 10px;
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    div.choose-bar > h2 {
        color: white;
    }

    :is(.cl1, .cl2) {
        height: 35px;
    }

    .cl1 {
        margin-top: 5px;
        display: flex;
    }

    .cl1 input {
        color: white;
        padding: 5px;
        border: none;
        outline: none;
        background-color: rgb(50, 50, 50);
        border: solid 1px rgb(60, 60, 60);
        border-right: none;
        border-radius: 4px;
        border-top-right-radius: 0px;
        border-bottom-right-radius: 0px;
    }

    .cl1 button {
        width: 50px;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: rgba(50, 50, 50, 0.811);
        border: solid 1px rgb(60, 60, 60);
        border-left: none;
        border-top-right-radius: 5px;
        border-bottom-right-radius: 5px;
        cursor: pointer;
    }

    .cl2 button {
        padding: 5px;
        display: flex;
        align-items: center;
        justify-content: center;
        column-gap: 5px;
        border-radius: 4px;
        background-color: green;
        border: solid .5px white;
        color: white;
        cursor: pointer;
    }
</style>
