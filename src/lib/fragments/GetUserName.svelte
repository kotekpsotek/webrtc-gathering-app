<script lang="ts">
    export let userName: string = "";
</script>

<div class="cn">
    <div class="src">
        <h2>Please pass here your name to continue</h2>
        <p class="desc">Enter your user name which will be using into application</p>
        <input type="text" placeholder="Your name" bind:value={userName}>
        <div class="go-further">
            <button on:click>Go</button>
        </div>
    </div>
</div>

<style>
    h2, div, p {
        margin: 0px;
    }

    .cn {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }
    
    .src {
        padding: 10px;
        background-color: rgb(50, 50, 50);
        border: solid 1px rgb(60, 60, 60);
        border-radius: 4px;
        display: flex;
        flex-direction: column;
    }
    
    h2 {
        color: white;
    }

    p.desc {
        color: rgb(172, 170, 170);
        margin-top: 4px;
    }

    input {
        font-family: 'Roboto', sans-serif;
        margin-top: 10px;
        width: 100%;
        height: 30px;
        color: white;
        background-color: rgb(113, 113, 113);
        border: solid 1px rgb(60, 60, 60);
        outline: none;
        border-radius: 4px;
    }

    input::placeholder {
        color: white;
    }

    div.go-further {
        margin-top: 4px;
        display: flex;
        justify-content: flex-end;
    }

    div.go-further button {
        font-family: 'Roboto', sans-serif;
        color: rgb(172, 170, 170);
        border: solid 1px rgb(170, 170, 170);
        border-radius: 4px;
        padding: 5px;
        outline: none;
        background-color: transparent;
        cursor: pointer;
    }
</style>
