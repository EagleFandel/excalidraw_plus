import { Injectable } from "@nestjs/common";

import {
  AiDisabledError,
  InvalidInputError,
} from "../common/exceptions/domain-errors";

import type { ConfigService } from "@nestjs/config";

import type { AuditService } from "../audit/audit.service";

import type { OpenAiCompatibleProvider } from "./providers/openai-compatible.provider";

type AiMessage = {
  role: "user" | "assistant";
  content: string;
};

@Injectable()
export class AiService {
  constructor(
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly openAiProvider: OpenAiCompatibleProvider,
  ) {}

  async generateDiagramToCode(input: {
    userId: string;
    texts: string[];
    image: string;
    theme?: string;
  }) {
    this.assertEnabled();

    const model =
      this.configService.get<string>("AI_DIAGRAM_TO_CODE_MODEL") ||
      "gpt-4.1-mini";
    const prompt = [
      "Generate an HTML document based on the provided diagram context.",
      "Return only HTML markup, no markdown fences.",
      `Theme hint: ${input.theme || "light"}`,
      `Extracted texts: ${input.texts.join(" | ") || "(none)"}`,
      `Image data URL: ${input.image}`,
    ].join("\n");

    const html = await this.openAiProvider.completeText({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a deterministic diagram-to-code assistant. Produce valid HTML output only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    await this.auditService.log({
      action: "AI_DIAGRAM_TO_CODE",
      actorUserId: input.userId,
      metadata: {
        model,
      },
    });

    return { html };
  }

  async generateTextToDiagram(input: {
    userId: string;
    messages: AiMessage[];
  }) {
    this.assertEnabled();

    if (!input.messages.length) {
      throw new InvalidInputError("messages is required");
    }

    const model =
      this.configService.get<string>("AI_TEXT_TO_DIAGRAM_MODEL") ||
      "gpt-4.1-mini";

    const generatedResponse = await this.openAiProvider.completeText({
      model,
      messages: [
        {
          role: "system",
          content:
            "You help users draft concise diagram descriptions and structure suggestions.",
        },
        ...input.messages,
      ],
    });

    await this.auditService.log({
      action: "AI_TEXT_TO_DIAGRAM",
      actorUserId: input.userId,
      metadata: {
        model,
        messages: input.messages.length,
      },
    });

    return generatedResponse;
  }

  private assertEnabled() {
    const enabled = Boolean(this.configService.get<boolean>("AI_ENABLED"));
    if (!enabled) {
      throw new AiDisabledError();
    }
  }
}
