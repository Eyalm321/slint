// Copyright © SixtyFPS GmbH <info@slint.dev>
// SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-Slint-Royalty-free-2.0 OR LicenseRef-Slint-Software-3.0

// Loads the Slint native addon.
//
// There are two binary-compatible variants of the addon, exposing the exact same
// JavaScript/TypeScript surface:
//
//   * the default release one (`rust-module.cjs` -> slint-ui.<platform>.node),
//     shipped with the `slint-ui` package, and
//   * the "dev" one (slint-ui-dev.<platform>.node) which additionally has the
//     `testing`, `system-testing` and `mcp` features compiled in.
//
// We prefer the dev binary when it is available, and otherwise fall back to the
// default one. It is resolved from, in order:
//
//   1. a locally built loader (`pnpm build:debug` / `build:dev`) next to this
//      file — only present in a source checkout / the test suite;
//   2. the optional `slint-ui-dev` package, installed as a dev dependency. It
//      ships the dev loader and depends on the matching native binary, and is
//      loaded through its `slint-ui-dev/loader` subpath (resolved by name so it
//      also works under pnpm's isolated node_modules). Importing `slint-ui-dev`
//      directly throws, to catch accidental use.
//
// Use `build_features()` to query which capabilities the loaded binary has.

"use strict";

function loadBinding() {
    // 1. Locally built dev binary (development and the test suite).
    try {
        return require("./rust-module-dev.cjs");
    } catch (error) {
        if (error && error.code !== "MODULE_NOT_FOUND") {
            throw error;
        }
    }

    // 2. The optional `slint-ui-dev` package. Its native binary is paired with a
    //    specific slint-ui version, so refuse to load it on a version mismatch:
    //    that would combine incompatible JavaScript glue and native code. The
    //    binary is loaded through the `slint-ui-dev/loader` subpath; the package
    //    entry point itself throws to catch accidental direct imports.
    try {
        const devVersion = require("slint-ui-dev/package.json").version;
        const ownVersion = require("./package.json").version;
        if (devVersion !== ownVersion) {
            console.warn(
                `[slint-ui] Ignoring slint-ui-dev ${devVersion}: it does not match ` +
                    `slint-ui ${ownVersion}. Install slint-ui-dev@${ownVersion} to enable ` +
                    `the development binary.`,
            );
        } else {
            return require("slint-ui-dev/loader");
        }
    } catch (error) {
        // Not installed, or its native binary is unavailable on this platform.
        if (error && error.code !== "MODULE_NOT_FOUND") {
            console.warn(
                `[slint-ui] Could not load slint-ui-dev: ${error.message}`,
            );
        }
    }

    // 3. Default release binary.
    return require("./rust-module.cjs");
}

module.exports = loadBinding();
