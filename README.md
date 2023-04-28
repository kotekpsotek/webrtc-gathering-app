# **Short Description**
Application to make WebRTC gathering between two peer's

## Preview images
1. Determing self username
![attend to aplication is predecessed by determining self user name](./docs/determining_username.png)
2. Attending to room and initial no active connections information
![attending and initial gathering room](./docs/attending_and_gathering_room.png)
3. GUI containing Video and Text chat communication between two connected peers gathered in same connection room,
![video and text-chat communcation in same room between gathered users](./docs/video_gathering_and_textchat_between_2_users.png)

## What perform to launch app?
`Windows os example:`
```cmd
    cd ./server-http && npm run br &:: To run http signaling server
    npm run dev &:: To run gathering application the simplest way is to run application in developer mode using vite dev server
```

# **License**
This project is researching and developing under MIT license.
