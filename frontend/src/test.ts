/**
 * Minimal dev helper to test the text generation backend over HTTP.
 * Usage (in browser console after bundling this file or importing it in a page):
 *   await window.testGenerateText('http://localhost:3000')
 */
export async function testGenerateText(baseUrl = 'http://localhost:3000'): Promise<void> {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/text/generate`;
  const payload = {
    inputs: {
      topic: 'hash-driven content planners',
      tone: 'confident and concise',
      audience: 'VP of Product',
      call_to_action: 'Highlight the benefits of delegating to AI agents.',
    },
    instructions: 'Compose an executive-ready summary that blends the provided hashes.',
  };

  const startedAt = performance.now();
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    const elapsed = performance.now() - startedAt;
    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = undefined;
    }
    console.log(`[Text Test] POST ${url} -> ${response.status} ${response.statusText} in ${elapsed.toFixed(0)}ms`);
    if (parsed !== undefined) {
      console.log(parsed);
    } else {
      console.log(text);
    }
  } catch (error) {
    const elapsed = performance.now() - startedAt;
    console.error(`[Text Test] Request failed in ${elapsed.toFixed(0)}ms`, error);
  }
}

// Attach to window for easy manual invocation when running in a browser
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).testGenerateText = testGenerateText;
