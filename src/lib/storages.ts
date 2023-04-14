import { writable } from "svelte/store";

export const userData = writable<{ userId: string, userIceCandidate: string }>({ userId: "", userIceCandidate: "" });

export interface ChatMessage {
    type: "same-user" | "other-user",
    content: string
}
export const chatMessages = writable<ChatMessage[]>([]);
