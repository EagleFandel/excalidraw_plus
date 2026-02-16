import { Injectable } from "@nestjs/common";

import { InvalidInputError } from "../../common/exceptions/domain-errors";

import type { ConfigService } from "@nestjs/config";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

@Injectable()
export class OpenAiCompatibleProvider {
  constructor(private readonly configService: ConfigService) {}

  async completeText(input: {
    model: string;
    messages: ChatMessage[];
  }): Promise<string> {
    const baseUrl = this.configService.get<string>("AI_BASE_URL") || "";
    const apiKey = this.configService.get<string>("AI_API_KEY") || "";
    const timeoutMs = Number(
      this.configService.get<number>("AI_TIMEOUT_MS") || 45_000,
    );

    if (!baseUrl || !apiKey) {
      throw new InvalidInputError("AI provider is not configured");
    }

    const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${normalizedBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: input.model,
          messages: input.messages,
          temperature: 0.2,
          stream: false,
        }),
        signal: controller.signal,
      });

      const payload = (await response
        .json()
        .catch(() => ({}))) as ChatCompletionResponse;

      if (!response.ok) {
        const reason =
          payload?.error?.message ||
          `AI provider request failed (${String(response.status)})`;
        throw new InvalidInputError(reason);
      }

      const content = payload?.choices?.[0]?.message?.content || "";
      if (!content.trim()) {
        throw new InvalidInputError("AI provider returned empty response");
      }

      return content;
    } catch (error) {
      if (error instanceof InvalidInputError) {
        throw error;
      }
      throw new InvalidInputError(
        error instanceof Error ? error.message : "AI provider request failed",
      );
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}
