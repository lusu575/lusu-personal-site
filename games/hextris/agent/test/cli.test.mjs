// SPDX-License-Identifier: GPL-3.0-or-later

import assert from "node:assert/strict";
import test from "node:test";
import {
  HextrisCliError,
  runHextrisAgentCli
} from "../cli.mjs";

test("programmatic CLI calls reject every non-string argv entry without coercion", async () => {
  let storeCalls = 0;
  const store = {
    createSession() {
      storeCalls += 1;
      return {};
    }
  };

  for (const argv of [
    ["create", "--seed", 7],
    [Object("help")],
    [null],
    Array(1)
  ]) {
    await assert.rejects(
      runHextrisAgentCli(argv, { store }),
      (error) => error instanceof HextrisCliError
        && error.code === "HEXTRIS_CLI_ARGUMENTS_INVALID"
    );
  }

  assert.equal(storeCalls, 0);
});
