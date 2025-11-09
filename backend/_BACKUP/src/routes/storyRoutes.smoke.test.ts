import { strict as assert } from "node:assert";
import { before, test } from "node:test";
import express from "express";
import request from "supertest";
import {
  createTextRouter,
} from "./storyRoutes.js";
import type {
  HashGenerationRequest,
  HashGenerationResult,
} from "../agents/orchestrator.js";

let app: express.Express;

before(() => {
  app = express();
  app.use(express.json());

  const fakeGenerate = async (
    payload: HashGenerationRequest,
  ): Promise<HashGenerationResult> => {
    const inputs = Object.fromEntries(
      Object.entries(payload.inputs).map(([key, value]) => [key, String(value)]),
    );
    return {
      text: `Echo ${Object.keys(inputs).join(", ")}`,
      prompt: "Test prompt",
      provider: "cloudflare-gateway",
      modelId: "test-model",
      inputs,
      jobId: payload.jobId ?? "hash-job-test",
      createdAt: "2025-01-01T00:00:00.000Z",
    };
  };

  app.use("/api/text", createTextRouter({ generateText: fakeGenerate }));
  app.get("/", (_req, res) => res.send("AI Text Engine Backend Running"));
});

test("GET / health returns 200 and message", async () => {
  const res = await request(app).get("/");
  assert.equal(res.status, 200);
  assert.match(res.text, /AI Text Engine Backend Running/);
});

test("POST /api/text/generate without inputs returns 400", async () => {
  const res = await request(app).post("/api/text/generate").send({});
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "Request body must include an 'inputs' object.");
});

test("POST /api/text/generate with inputs returns 200 and text response", async () => {
  const res = await request(app)
    .post("/api/text/generate")
    .set("Content-Type", "application/json")
    .send({
      inputs: {
        topic: "hash pipelines",
        tone: "confident",
      },
      instructions: "Provide a short answer.",
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.text, "Echo topic, tone");
  assert.equal(res.body.modelId, "test-model");
  assert.equal(res.body.provider, "cloudflare-gateway");
  assert.equal(res.body.jobId, "hash-job-test");
  assert.equal(res.body.createdAt, "2025-01-01T00:00:00.000Z");
});
