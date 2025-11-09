import { randomUUID } from "node:crypto";
import { loadEnv } from "../config/env.js";
import {
  generateHashText,
  type HashTextRequest,
  type HashTextResult,
} from "./textAgent.js";

loadEnv();

export interface HashGenerationRequest extends HashTextRequest {
  jobId?: string;
}

export interface HashGenerationResult extends HashTextResult {
  jobId: string;
  createdAt: string;
}

export async function generateTextFromHashes(
  request: HashGenerationRequest,
): Promise<HashGenerationResult> {
  const jobId = resolveJobId(request.jobId, request.inputs);
  const hashRequest: HashTextRequest = {
    inputs: request.inputs,
  };

  if (request.instructions !== undefined) {
    hashRequest.instructions = request.instructions;
  }

  const baseResult = await generateHashText(hashRequest);

  return {
    ...baseResult,
    jobId,
    createdAt: new Date().toISOString(),
  };
}

function resolveJobId(
  provided: string | undefined,
  inputs: HashTextRequest["inputs"],
): string {
  const trimmed = provided?.trim();
  if (trimmed) {
    return trimmed;
  }

  const keys = inputs ? Object.keys(inputs) : [];
  if (keys.length > 0) {
    const digestSource = JSON.stringify(
      keys.sort().map((key) => [key, inputs?.[key]]),
    );
    return `hash-job-${stableHash(digestSource)}`;
  }

  return `hash-job-${randomUUID()}`;
}

function stableHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}