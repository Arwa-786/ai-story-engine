import { strict as assert } from "node:assert";
import { test, before } from "node:test";
import express from "express";
import request from "supertest";
import { createStoryRouter } from "./storyRoutes.js";
import type { StoryNode } from "../types/story.js";

let app: express.Express;

before(() => {
  app = express();
  app.use(express.json());

  const fakeGenerate = async (genre: string): Promise<StoryNode> => ({
    id: "root",
    is_ending: false,
    text: `A test ${genre} story.`,
    choices: [
      { id: "C1", text: "Go north", nextNodeId: "N2_A" },
      { id: "C2", text: "Go south", nextNodeId: "N2_B" },
      { id: "C3", text: "Go east", nextNodeId: "N2_C" },
    ],
  });

  app.use("/api/story", createStoryRouter({ generateStoryTree: fakeGenerate }));
  app.get("/", (_req, res) => res.send("AI Story Engine Backend Running"));
});

test("GET / health returns 200 and message", async () => {
  const res = await request(app).get("/");
  assert.equal(res.status, 200);
  assert.match(res.text, /AI Story Engine Backend Running/);
});

test("POST /api/story/start without genre returns 400", async () => {
  const res = await request(app).post("/api/story/start").send({});
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "Genre is required to start a story.");
});

test("POST /api/story/start with genre returns 200 and StoryNode", async () => {
  const res = await request(app)
    .post("/api/story/start")
    .set("Content-Type", "application/json")
    .send({ genre: "fantasy" });

  assert.equal(res.status, 200);
  assert.equal(res.body.id, "root");
  assert.equal(typeof res.body.text, "string");
  assert.equal(res.body.is_ending, false);
  assert.ok(Array.isArray(res.body.choices));
  assert.equal(res.body.choices.length, 3);
});


