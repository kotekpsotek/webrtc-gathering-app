<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { SendAltFilled } from "carbon-icons-svelte";
    import { type ChatMessage, chatMessages } from "$lib/storages";
    
    export let value: string = "";

    let focusOnMessageInput = true;

    const dispatcher = createEventDispatcher();

    /** Send message when user press "Enter" keyboard button and has got focus on message input element */
    function userClickEnterWhileFocusOnMessageInput(ev: Event) {
        if ((ev as KeyboardEvent).key == "Enter" && focusOnMessageInput) {
            sendMessage(ev);
        }
    }

    /** Send message after click on button to send message */
    /** Message will be send only when it content isn't empty */
    function sendMessage(ev: Event) {
        if (value.length) { // Disable oportunity to send empty message
            // Create event to save message from chat and send it to other user using RTC DataChannel
            dispatcher("message-sended", value);

            // Save message content into GUI
            chatMessages.update(chatData => {
                // Create this message object matched to chatData message object pattern
                const thisNewMessage: ChatMessage = {
                    type: "same-user",
                    content: value
                };

                // Add message content to storage witch chat messages
                chatData.push(thisNewMessage);
                
                // Update chat datas
                return chatData;
            });

            // Reset input to pass message value
            value = "";

            // Scroll page maximum down
            setTimeout(() => {
                window.scroll({ top: document.body.scrollHeight, behavior: "smooth" });
            }, 50)
        }
    }

    /** When user click on input element to send message using mouse or laptop touchpad */
    function userHasInputFocus() {
        focusOnMessageInput = true;
    }

    /** When user click beyond input to send message */
    function userLoseInputFocus() {
        focusOnMessageInput = false;
    }
</script>

<!-- Allow user to send messages when user has got focus on input element to send messages and user click keyboard "Enter" key durning focus presence -->
<svelte:body on:keypress={userClickEnterWhileFocusOnMessageInput}/>

<div class="chat">
    <h2>Chat</h2>
    <div class="messages">
        {#key $chatMessages}
            {#each $chatMessages as { type, content }}
                <div class="message" class:me={type == "same-user"} class:other={type == "other-user"}>
                    <div class="content">
                        <p>{content}</p>
                    </div>
                </div>
            {/each}
        {/key}
    </div>
    <div class="add-message">
        <input type="text" placeholder="Text message" bind:value on:focus={userHasInputFocus} on:blur={userLoseInputFocus}>
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
        row-gap: 5px;
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
