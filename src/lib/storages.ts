import { writable } from "svelte/store";

export const userData = writable<{ userId: string }>({ userId: "" });