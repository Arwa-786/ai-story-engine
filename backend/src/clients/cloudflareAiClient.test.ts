import { strict as assert } from "node:assert";
import { test } from "node:test";
import { Response } from "undici";
import { CloudflareAiClient } from "./cloudflareAiClient.js";

type FetchFn = (typeof import("undici"))["fetch"];

const baseConfig = {
  accountId: "acc",
  apiToken: "token",
  model: "@cf/test/model",
};

test("CloudflareAiClient parses valid JSON responses", async () => {
  const fakeFetch: FetchFn = async () =>
    new Response(
      JSON.stringify({
        result: {
          response: JSON.stringify({
            id: "root",
            is_ending: false,
            text: "Intro",
            choices: [],
          }),
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );

  const client = new CloudflareAiClient(baseConfig, fakeFetch);
  const node = await client.generateStoryTree("prompt");

  assert.equal(node.id, "root");
  assert.equal(node.text, "Intro");
  assert.equal(node.is_ending, false);
  assert.ok(Array.isArray(node.choices));
});

test("CloudflareAiClient surfaces HTTP errors with diagnostics", async () => {
  const fakeFetch: FetchFn = async () =>
    new Response("Bad Request", { status: 400, statusText: "Bad Request" });

  const client = new CloudflareAiClient(baseConfig, fakeFetch);

  await assert.rejects(
    () => client.generateStoryTree("prompt"),
    /Cloudflare AI request failed with status 400/,
  );
});

test("CloudflareAiClient rejects invalid JSON payloads", async () => {
  const fakeFetch: FetchFn = async () =>
    new Response(
      JSON.stringify({
        result: { response: "not-json" },
      }),
      { status: 200 },
    );

  const client = new CloudflareAiClient(baseConfig, fakeFetch);

  await assert.rejects(
    () => client.generateStoryTree("prompt"),
    /invalid JSON payload/,
  );
});

