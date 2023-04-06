import express from "express";
import socket from "socket.io";
import http from "http";
import path from "path";
import cors from "cors";
import ejs from "ejs";
import wsModule from "./websocket";

const app = express();
const server = http.createServer(app);
const socketio = new socket.Server(server, {
    cors: {
        origin: "*",
        methods: ["POST", "GET", "PUT"]
    }
});

// Launch websocket part of application
wsModule(socketio);

app.use(express.static(path.join(__dirname, "frontend")));
app.use(cors({ origin: "*", methods: ["POST", "GET", "PUT"] }));
app.engine("html", ejs.renderFile)

app.set("views", path.join(__dirname, "/../", "frontend"))
app.set("view engine", "html");

app.get("/", (req, res) => {
    res.render("root.html")    
});


server.listen(8080, () => console.log("Server is listening for connections"))
