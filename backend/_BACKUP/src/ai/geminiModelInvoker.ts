import type { TextAgentConfig } from "../config/textAgents.js";
import { generateGeminiContentViaGateway } from "./geminiGatewayClient.js";

export interface GeminiInvocationOptions {
  agentConfig: TextAgentConfig;
  modelId: string;
  prompt: string;
}

export async function invokeGeminiModel(
  options: GeminiInvocationOptions,
): Promise<string> {
  const { agentConfig, modelId, prompt } = options;

  // Always use Cloudflare Gateway
  const gatewayRequest: Parameters<typeof generateGeminiContentViaGateway>[0] = {
      modelId,
      prompt,
    responseMimeType: agentConfig.responseMimeType ?? "application/json",
  };

  if (typeof agentConfig.temperature === "number") {
    gatewayRequest.temperature = agentConfig.temperature;
  }

  if (typeof agentConfig.maxOutputTokens === "number") {
    gatewayRequest.maxOutputTokens = agentConfig.maxOutputTokens;
  }
  
  if (agentConfig.apiVersion) {
    gatewayRequest.apiVersion = agentConfig.apiVersion;
  }

  if (agentConfig.gatewayProviderSlug) {
    gatewayRequest.providerSlug = agentConfig.gatewayProviderSlug;
  }
  
  if (agentConfig.baseUrlOverride) {
    gatewayRequest.baseUrlOverride = agentConfig.baseUrlOverride;
  }
  
  return await generateGeminiContentViaGateway(gatewayRequest);
}

export function composeAgentPrompt(
  systemPrompt: string | undefined,
  userPrompt: string,
): string {
  const trimmedSystem = systemPrompt?.trim();
  if (!trimmedSystem) {
    return userPrompt;
  }

  if (userPrompt.trim().length === 0) {
    return trimmedSystem;
  }

  return `${trimmedSystem}\n\n${userPrompt}`;
}


