import { describe, it } from "@effect/vitest"
import { deepStrictEqual } from "@effect/vitest/utils"
import { Effect, Exit, Schema } from "effect"
import { Response, Tool, Toolkit } from "effect/unstable/ai"

describe("Response", () => {
  const KnownTool = Tool.make("KnownTool", {
    parameters: Schema.Struct({ value: Schema.Number }),
    success: Schema.Struct({ ok: Schema.Boolean })
  })
  const toolkit = Toolkit.make(KnownTool)

  it.effect("decodes response metadata with omitted optional fields", () =>
    Effect.gen(function*() {
      const encoded: Response.ResponseMetadataPartEncoded = {
        type: "response-metadata"
      }

      const decoded = yield* Schema.decodeUnknownEffect(Response.ResponseMetadataPart)(encoded)

      deepStrictEqual(decoded, Response.makePart("response-metadata", {}))
    }))

  it.effect("round trips response metadata with undefined optional fields through JSON", () =>
    Effect.gen(function*() {
      const part = Response.makePart("response-metadata", {
        id: undefined,
        modelId: undefined,
        timestamp: undefined,
        request: undefined
      })

      const encoded = yield* Schema.encodeEffect(Response.ResponseMetadataPart)(part)
      const json = JSON.parse(JSON.stringify(encoded))
      const decoded = yield* Schema.decodeUnknownEffect(Response.ResponseMetadataPart)(json)

      deepStrictEqual(json, {
        metadata: {},
        type: "response-metadata"
      }, "encoded JSON")
      deepStrictEqual(decoded, Response.makePart("response-metadata", {}), "decoded part")
    }))

  it.effect("round trips HTTP request details with an undefined hash through JSON", () =>
    Effect.gen(function*() {
      const request: typeof Response.HttpRequestDetails.Type = {
        method: "POST",
        url: "https://example.com/v1/responses",
        urlParams: [],
        hash: undefined,
        headers: {}
      }

      const encoded = yield* Schema.encodeEffect(Response.HttpRequestDetails)(request)
      const json = JSON.parse(JSON.stringify(encoded))
      const decoded = yield* Schema.decodeUnknownEffect(Response.HttpRequestDetails)(json)

      deepStrictEqual(json, {
        method: "POST",
        url: "https://example.com/v1/responses",
        urlParams: [],
        headers: {}
      }, "encoded JSON")
      deepStrictEqual(decoded, {
        method: "POST",
        url: "https://example.com/v1/responses",
        urlParams: [],
        headers: {}
      }, "decoded request")
    }))

  it.effect("round trips a finish part with undefined optional fields through JSON", () =>
    Effect.gen(function*() {
      const part = Response.makePart("finish", {
        reason: "stop",
        usage: new Response.Usage({
          inputTokens: {
            uncached: undefined,
            total: undefined,
            cacheRead: undefined,
            cacheWrite: undefined
          },
          outputTokens: {
            total: undefined,
            text: undefined,
            reasoning: undefined
          }
        }),
        response: undefined
      })

      const encoded = yield* Schema.encodeEffect(Response.FinishPart)(part)
      const json = JSON.parse(JSON.stringify(encoded))
      const decoded = yield* Schema.decodeUnknownEffect(Response.FinishPart)(json)

      deepStrictEqual(json, {
        metadata: {},
        type: "finish",
        reason: "stop",
        usage: {
          inputTokens: {},
          outputTokens: {}
        }
      }, "encoded JSON")
      deepStrictEqual(
        decoded,
        Response.makePart("finish", {
          reason: "stop",
          usage: new Response.Usage({
            inputTokens: {},
            outputTokens: {}
          })
        }),
        "decoded part"
      )
    }))

  it.effect("keeps toolkit-specific response schemas restricted to known tools", () =>
    Effect.gen(function*() {
      const unknownToolCall = {
        type: "tool-call",
        id: "call_unknown",
        name: "UnknownTool",
        params: { value: 1 }
      } as const

      for (const schema of [Response.AllParts(toolkit), Response.Part(toolkit), Response.StreamPart(toolkit)]) {
        const exit = yield* Effect.exit(Schema.decodeUnknownEffect(schema)(unknownToolCall))
        deepStrictEqual(Exit.isFailure(exit), true)
      }
    }))

  it.effect("decodes unknown tools with any response schemas", () =>
    Effect.gen(function*() {
      const toolCall = {
        type: "tool-call",
        id: "call_unknown",
        name: "UnknownTool",
        params: { value: 1 }
      } as const
      const toolResult = {
        type: "tool-result",
        id: "call_unknown",
        name: "UnknownTool",
        isFailure: false,
        result: { value: 1 }
      } as const

      for (
        const schema of [Response.AnyAllParts(toolkit), Response.AnyPart(toolkit), Response.AnyStreamPart(toolkit)]
      ) {
        const decodedCall = yield* Schema.decodeUnknownEffect(schema)(toolCall)
        const decodedResult = yield* Schema.decodeUnknownEffect(schema)(toolResult)

        deepStrictEqual(yield* Schema.encodeEffect(schema)(decodedCall), {
          ...toolCall,
          providerExecuted: false,
          metadata: {}
        })
        deepStrictEqual(yield* Schema.encodeEffect(schema)(decodedResult), {
          ...toolResult,
          providerExecuted: false,
          metadata: {},
          preliminary: false
        })
      }
    }))

  it.effect("preserves known tool validation in any response schemas", () =>
    Effect.gen(function*() {
      const invalidToolCall = {
        type: "tool-call",
        id: "call_known",
        name: "KnownTool",
        params: { value: "not-a-number" }
      } as const
      const invalidToolResult = {
        type: "tool-result",
        id: "call_known",
        name: "KnownTool",
        isFailure: false,
        result: { ok: "not-a-boolean" }
      } as const

      for (
        const schema of [Response.AnyAllParts(toolkit), Response.AnyPart(toolkit), Response.AnyStreamPart(toolkit)]
      ) {
        deepStrictEqual(Exit.isFailure(yield* Effect.exit(Schema.decodeUnknownEffect(schema)(invalidToolCall))), true)
        deepStrictEqual(Exit.isFailure(yield* Effect.exit(Schema.decodeUnknownEffect(schema)(invalidToolResult))), true)
      }
    }))
})
