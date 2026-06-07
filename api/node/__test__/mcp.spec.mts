// Copyright © SixtyFPS GmbH <info@slint.dev>
// SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-Slint-Royalty-free-2.0 OR LicenseRef-Slint-Software-3.0

// Smoke test for the embedded MCP server, which is only available in the "dev"
// binary (mcp feature). The server auto-starts when a backend is created and the
// SLINT_MCP_PORT environment variable is set, so we configure it before touching
// the event loop and then talk to it over HTTP.

import { test, expect, afterEach } from "vitest";
import * as net from "node:net";

import { runEventLoop, quitEventLoop, private_api } from "../dist/index.js";

const isDevBinary = private_api.buildFeatures().includes("mcp");

afterEach(() => {
    quitEventLoop();
});

// Pick an ephemeral port by briefly binding one and releasing it again.
function pickFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.on("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const port = (server.address() as net.AddressInfo).port;
            server.close(() => resolve(port));
        });
    });
}

async function initializeMcp(port: number): Promise<any> {
    // The server is spawned onto the Slint event loop and may not be listening
    // immediately, so retry the request a few times.
    let lastError: unknown;
    for (let attempt = 0; attempt < 40; attempt++) {
        try {
            const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "initialize",
                    params: {},
                }),
            });
            if (response.ok) {
                return await response.json();
            }
            lastError = new Error(`HTTP ${response.status}`);
        } catch (error) {
            lastError = error;
        }
        await new Promise((r) => setTimeout(r, 50));
    }
    throw lastError ?? new Error("MCP server did not respond");
}

test.skipIf(!isDevBinary).sequential(
    "MCP server responds to initialize",
    async () => {
        const port = await pickFreePort();
        // The MCP server reads SLINT_MCP_PORT when the backend starts, so set it
        // before any window is shown.
        process.env.SLINT_MCP_PORT = String(port);

        const compiler = new private_api.ComponentCompiler();
        const definition = compiler.buildFromSource(
            `export component App inherits Window {
                width: 200px;
                height: 200px;
            }`,
            "",
        );
        const instance = definition.App!.create();
        const window = instance!.window();

        let result: any;
        await runEventLoop(async () => {
            try {
                // The server is spawned by the window-shown hook, so we must show a
                // window with the event loop running.
                window.show();
                result = await initializeMcp(port);
            } finally {
                window.hide();
                quitEventLoop();
            }
        });

        delete process.env.SLINT_MCP_PORT;

        expect(result?.jsonrpc).toBe("2.0");
        expect(result?.result?.protocolVersion).toBeTypeOf("string");
        expect(result?.result?.capabilities?.tools).toBeTypeOf("object");
    },
);
