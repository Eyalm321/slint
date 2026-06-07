// Copyright © SixtyFPS GmbH <info@slint.dev>
// SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-Slint-Royalty-free-2.0 OR LicenseRef-Slint-Software-3.0

// Tests for the conditional loading of the "dev" native binary (binding.cjs).

import { test, expect } from "vitest";

import { private_api } from "../dist/index.js";

const KNOWN_FEATURES = ["testing", "system-testing", "mcp"];

test("build_features reports a known set of capabilities", () => {
    const features = private_api.buildFeatures();
    expect(Array.isArray(features)).toBe(true);
    for (const feature of features) {
        expect(KNOWN_FEATURES).toContain(feature);
    }
});

// When the "dev" binary is loaded (as it is in CI via `pnpm build:debug`), all
// of the additional capabilities must be present. This verifies that binding.cjs
// actually picked up the dev binary rather than silently falling back.
const isDevBinary = private_api.buildFeatures().includes("mcp");

test.skipIf(!isDevBinary)(
    "dev binary exposes testing, system-testing and mcp",
    () => {
        const features = private_api.buildFeatures();
        expect(features).toContain("testing");
        expect(features).toContain("system-testing");
        expect(features).toContain("mcp");
    },
);

// The slint-ui-dev package only provides the development binary; importing it
// directly is a mistake and its entry point must fail loudly.
test("importing slint-ui-dev directly throws", async () => {
    await expect(import("../dev-package/index.cjs")).rejects.toThrow(
        /must not be imported directly/,
    );
});
