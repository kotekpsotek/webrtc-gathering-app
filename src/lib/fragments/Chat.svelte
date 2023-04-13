<script lang="ts">
    import { SendAltFilled } from "carbon-icons-svelte"
    
    export let value: string;

    /** Send message after click on button to send message */
    function sendMessage(ev: Event) {

    }
</script>

<div class="chat">
    <h2>Chat</h2>
    <div class="messages">
        <div class="message me">
            <div class="content">
                <p>My message</p>
            </div>
        </div>
        <div class="message other">
            <div class="content">
                <p>Other message</p>
            </div>
        </div>
    </div>
    <div class="add-message">
        <input type="text" placeholder="Text message" bind:value>
        <button class="send-message" on:click={sendMessage}>
            <SendAltFilled size={24} fill="whitesmoke"/>
        </button>
    </div>
</div>

<style>
    p {
        padding: 0px;
        margin: 0px;
    }
    
    /* Container with all chat elements and Chat element title as <h2></h2> html elemnt */
    .chat {
        margin-top: 10px;
        background-color: rgb(50, 50, 50);
        border: solid 1px rgb(60, 60, 60);
        border-radius: 4px;
        padding: 5px;
    }

    h2 {
        color: white;
        width: fit-content;
        padding-bottom: 5px;
        border-bottom: solid 1px white;
    }

    /* Container with sended from users messages */
    .messages {
        display: flex;
        flex-direction: column;
    }

    .messages .message.me {
        display: flex;
        justify-content: flex-end;
    }

    .messages .message.other {
        display: flex;
        justify-content: flex-start;
    }

    .message .content {
        padding: 8px;
        max-width: 50%;
        border-radius: 8px;
        color: whitesmoke;
        border: solid 1px whitesmoke;
    }

    .message.me .content {
        background-color: rgb(0, 157, 255);
    }

    /* Contener with elements to send message */
    .add-message {
        --message-button-width: 50px;
        width: 100%;
        height: 40px;
        margin-top: 10px;
        padding-top: 5px;
        border-top: solid 1px rgb(45, 45, 45);
        display: flex;
    }

    .add-message input {
        width: calc(100% - var(--message-button-width));
        padding: 4px;
        outline: none;
        border: solid 1px rgb(45, 45, 45);
        border-right: none;
        background-color: rgb(58, 58, 58);
        border-top-left-radius: 4px;
        border-bottom-left-radius: 4px;
        color: whitesmoke;
    }

    .add-message button {
        width: var(--message-button-width);
        display: flex;
        justify-content: center;
        align-items: center;
        outline: none;
        border: solid 1px rgb(45, 45, 45);
        background-color: rgb(58, 58, 58);
        border-top-right-radius: 4px;
        border-bottom-right-radius: 4px;
        cursor: pointer;
    }
</style>
