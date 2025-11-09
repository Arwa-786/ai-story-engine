import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

let loaded = false;

export function loadEnv(): void {
	if (loaded) return;

	// Try project-root .env using a stable, file-based path (works regardless of CWD)
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);
	const projectRoot = path.resolve(__dirname, "../../..");
	const rootEnvPath = path.join(projectRoot, ".env");

	// 1) Load from project root explicitly
	dotenv.config({ path: rootEnvPath });
	// 2) Also allow fallback to current working directory if a local .env exists
	dotenv.config();

	loaded = true;
}

export function validateRequiredEnvVars(): void {
	const missingVars: string[] = [];

	// Common required variables
	if (!process.env.PORT) {
		missingVars.push("PORT");
	}

	// Cloudflare Gateway requirements (always required)
	if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
		missingVars.push("CLOUDFLARE_ACCOUNT_ID");
	}
	if (!process.env.CLOUDFLARE_AI_GATEWAY_ID) {
		missingVars.push("CLOUDFLARE_AI_GATEWAY_ID");
	}
	// Use only Cloudflare Gateway token for compat endpoint
	if (!process.env.CLOUDFLARE_API_KEY) {
		missingVars.push("CLOUDFLARE_API_KEY (required for Cloudflare AI Gateway compat)");
	}

	if (missingVars.length > 0) {
		console.error("\n❌ CONFIGURATION ERROR: Missing required environment variables:");
		missingVars.forEach(varName => {
			console.error(`   - ${varName}`);
		});
		console.error("\n📝 Please create a .env file in the project root with the required variables.");
		console.error("\n🤖 Using Cloudflare AI Gateway (compat, token-only)");
		
		console.error("\nExample .env configuration:");
		console.error("PORT=3000");
		console.error("CLOUDFLARE_ACCOUNT_ID=your_account_id");
		console.error("CLOUDFLARE_AI_GATEWAY_ID=your_gateway_id");
		console.error("CLOUDFLARE_API_KEY=your_cloudflare_gateway_token");
		console.error("GEMINI_MODEL_ID=gemini-1.5-pro-latest");
		console.error("CLOUDFLARE_AI_GATEWAY_PROVIDER=google-ai-studio");
		
		console.error("\n");
		process.exit(1);
	}

	console.log("✅ All required environment variables are set");
	console.log("🤖 Using Cloudflare AI Gateway (compat) for text generation");
}


