"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const socket_io_1 = __importDefault(require("socket.io"));
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const ejs_1 = __importDefault(require("ejs"));
const websocket_1 = __importDefault(require("./websocket"));
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const socketio = new socket_io_1.default.Server(server, {
    cors: {
        origin: "*",
        methods: ["POST", "GET", "PUT"]
    }
});
// Launch websocket part of application
(0, websocket_1.default)(socketio);
app.use(express_1.default.static(path_1.default.join(__dirname, "frontend")));
app.use((0, cors_1.default)({ origin: "*", methods: ["POST", "GET", "PUT"] }));
app.engine("html", ejs_1.default.renderFile);
app.set("views", path_1.default.join(__dirname, "/../", "frontend"));
app.set("view engine", "html");
app.get("/", (req, res) => {
    res.render("root.html");
});
server.listen(8080, () => console.log("Server is listening for connections"));
