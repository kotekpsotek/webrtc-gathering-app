import { json, error } from "@sveltejs/kit";
import { randomUUID } from "crypto";

export const POST = (async ({ request }) => {
    const { userName } = await request.json();
    if (userName) {
        const userId = randomUUID();
        return json({ userId });    
    }

    throw error(406);
});
