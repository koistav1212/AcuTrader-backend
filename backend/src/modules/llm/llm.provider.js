import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

// Error Classifications
export const LLM_ERRORS = {
  PROVIDER_RATE_LIMIT: "PROVIDER_RATE_LIMIT",
  PROVIDER_TIMEOUT: "PROVIDER_TIMEOUT",
  PROVIDER_AUTH_ERROR: "PROVIDER_AUTH_ERROR",
  PROVIDER_SERVER_ERROR: "PROVIDER_SERVER_ERROR",
  CONTEXT_TOO_LARGE: "CONTEXT_TOO_LARGE",
  EMPTY_LLM_RESPONSE: "EMPTY_LLM_RESPONSE",
  UNKNOWN_LLM_ERROR: "UNKNOWN_LLM_ERROR"
};

class LLMError extends Error {
  constructor(type, message, provider) {
    super(message);
    this.type = type;
    this.provider = provider;
  }
}

class LLMProvider {
  constructor() {
    this.primaryProvider = "OPENROUTER";
    this.openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY || "",
    });
    
    // Groq is compatible with OpenAI SDK
    this.groq = createOpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY || "",
    });
    
    this.primaryModelName = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct";
    this.fallbackModelName = process.env.GROQ_MODEL || "llama3-70b-8192";
    
    // Queue state
    this.isProcessingQueue = false;
    this.queue = [];
    
    // 60 seconds minimum delay
    this.DELAY_MS = 60000;
    this.MAX_RETRIES = 3;
    this.REQUEST_TIMEOUT_MS = 90000; // 90 seconds
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  _classifyError(error, provider) {
    const errString = (error.message || "").toLowerCase();
    const status = error.statusCode || error.status;
    
    if (status === 429 || errString.includes("rate limit") || errString.includes("too many requests")) {
      return new LLMError(LLM_ERRORS.PROVIDER_RATE_LIMIT, error.message, provider);
    }
    if (status === 401 || status === 403 || errString.includes("auth") || errString.includes("key")) {
      return new LLMError(LLM_ERRORS.PROVIDER_AUTH_ERROR, error.message, provider);
    }
    if (status >= 500 || errString.includes("server error") || errString.includes("internal error")) {
      return new LLMError(LLM_ERRORS.PROVIDER_SERVER_ERROR, error.message, provider);
    }
    if (error.name === "AbortError" || errString.includes("timeout")) {
      return new LLMError(LLM_ERRORS.PROVIDER_TIMEOUT, error.message, provider);
    }
    if (errString.includes("context length") || errString.includes("maximum context length") || errString.includes("too large")) {
      return new LLMError(LLM_ERRORS.CONTEXT_TOO_LARGE, error.message, provider);
    }
    return new LLMError(LLM_ERRORS.UNKNOWN_LLM_ERROR, error.message, provider);
  }

  async _executeWithTimeoutAndRetry(model, systemPrompt, userPrompt, providerName, maxRetries) {
    let attempt = 0;
    
    while (attempt <= maxRetries) {
      attempt++;
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), this.REQUEST_TIMEOUT_MS);
      
      try {
        const { text } = await generateText({
          model: model,
          system: systemPrompt,
          prompt: userPrompt,
          temperature: 0.1,
          abortSignal: abortController.signal
        });
        
        clearTimeout(timeout);
        
        if (!text || text.trim() === "") {
          throw new LLMError(LLM_ERRORS.EMPTY_LLM_RESPONSE, "LLM returned empty response", providerName);
        }
        
        return text;
      } catch (error) {
        clearTimeout(timeout);
        const classifiedError = error instanceof LLMError ? error : this._classifyError(error, providerName);
        
        // Don't retry auth errors or context too large
        if (classifiedError.type === LLM_ERRORS.PROVIDER_AUTH_ERROR || 
            classifiedError.type === LLM_ERRORS.CONTEXT_TOO_LARGE) {
          throw classifiedError;
        }
        
        if (attempt <= maxRetries) {
          // Exponential backoff: 2s, 4s, 8s
          const backoff = Math.pow(2, attempt) * 1000;
          console.warn(`[LLMProvider][${providerName}] Attempt ${attempt} failed: ${classifiedError.type}. Retrying in ${backoff}ms...`);
          await this._sleep(backoff);
        } else {
          throw classifiedError;
        }
      }
    }
  }

  async _processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      const startTime = Date.now();
      
      const inputTokens = Math.ceil((task.systemPrompt.length + task.userPrompt.length) / 4);
      console.log(`[LLM][${task.ticker}] Starting request. Provider: ${this.primaryProvider}, InputTokens: ~${inputTokens}`);
      
      let text = null;
      let providerUsed = "OPENROUTER";
      let fallbackUsed = false;
      let finalError = null;

      try {
        text = await this._executeWithTimeoutAndRetry(
          this.openrouter(this.primaryModelName), 
          task.systemPrompt, 
          task.userPrompt, 
          "OPENROUTER", 
          this.MAX_RETRIES
        );
      } catch (err) {
        console.warn(`[LLM][${task.ticker}] OpenRouter failed after retries: ${err.type || err.message}. Falling back to Groq.`);
        
        try {
          providerUsed = "GROQ";
          fallbackUsed = true;
          text = await this._executeWithTimeoutAndRetry(
            this.groq(this.fallbackModelName),
            task.systemPrompt,
            task.userPrompt,
            "GROQ",
            this.MAX_RETRIES
          );
        } catch (fallbackErr) {
          finalError = fallbackErr;
        }
      }

      const durationMs = Date.now() - startTime;
      
      if (finalError) {
        console.error(`[LLM][${task.ticker}] provider=${providerUsed} model=${fallbackUsed ? this.fallbackModelName : this.primaryModelName} inputTokens=~${inputTokens} durationMs=${durationMs} error=${finalError.type}`);
        task.reject(finalError);
      } else {
        const outputTokens = Math.ceil(text.length / 4);
        console.log(`[LLM][${task.ticker}] provider=${providerUsed} model=${fallbackUsed ? this.fallbackModelName : this.primaryModelName} inputTokens=~${inputTokens} outputTokens=~${outputTokens} durationMs=${durationMs} status=success`);
        
        task.resolve({
          text,
          provider: providerUsed,
          fallbackUsed,
          metadata: {
            durationMs,
            inputTokens,
            outputTokens,
            model: fallbackUsed ? this.fallbackModelName : this.primaryModelName
          }
        });
      }

      // Mandatory 60-second delay between tasks
      if (this.queue.length > 0) {
        console.log(`[LLMProvider] Waiting ${this.DELAY_MS}ms before next request...`);
        await this._sleep(this.DELAY_MS);
      }
    }

    this.isProcessingQueue = false;
  }

  generate(systemPrompt, userPrompt, ticker = "UNKNOWN") {
    return new Promise((resolve, reject) => {
      this.queue.push({
        systemPrompt,
        userPrompt,
        ticker,
        resolve,
        reject
      });
      
      // Start processing if not already running
      if (!this.isProcessingQueue) {
        this._processQueue();
      }
    });
  }
}

export default new LLMProvider();
