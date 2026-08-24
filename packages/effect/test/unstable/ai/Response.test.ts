import { describe, it } from "@effect/vitest"
import { deepStrictEqual } from "@effect/vitest/utils"
import { Effect, Exit, Schema } from "effect"
import { Response, Tool, Toolkit } from "effect/unstable/ai"

const decode = (schema: Schema.Codec<any, any>, value: unknown) =>
  Schema.decodeUnknownEffect(schema)(value) as Effect.Effect<unknown, Schema.SchemaError>

describe("Response", () => {
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

  it.effect("decodes a tool call for a tool outside the toolkit", () =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeUnknownEffect(Response.AnyToolCallPart)({
        type: "tool-call",
        id: "call_unknown",
        name: "UnknownTool",
        params: { value: 1 }
      })

      deepStrictEqual(
        decoded,
        Response.makePart("tool-call", {
          id: "call_unknown",
          name: "UnknownTool",
          params: { value: 1 },
          providerExecuted: false
        })
      )
    }))

  it.effect("decodes a tool result for a tool outside the toolkit", () =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeUnknownEffect(Response.AnyToolResultPart)({
        type: "tool-result",
        id: "call_unknown",
        name: "UnknownTool",
        isFailure: false,
        result: { value: 1 }
      })

      deepStrictEqual(
        decoded,
        Response.makePart("tool-result", {
          id: "call_unknown",
          name: "UnknownTool",
          isFailure: false,
          result: { value: 1 },
          encodedResult: { value: 1 },
          providerExecuted: false,
          preliminary: false
        })
      )
    }))

  it.effect("supports any tool calls and results with an empty toolkit", () =>
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
        const schema of [
          Response.AllParts(Toolkit.empty),
          Response.Part(Toolkit.empty),
          Response.StreamPart(Toolkit.empty)
        ]
      ) {
        yield* decode(schema, toolCall)
        yield* decode(schema, toolResult)
      }
    }))

  it.effect("supports unknown tools alongside toolkit-specific schemas", () =>
    Effect.gen(function*() {
      const toolkit = Toolkit.make(
        Tool.make("KnownTool", {
          parameters: Schema.Struct({ value: Schema.Number }),
          success: Schema.Struct({ ok: Schema.Boolean })
        })
      )
      const unknown = {
        type: "tool-call",
        id: "call_unknown",
        name: "UnknownTool",
        params: { value: 1 }
      }

      for (const schema of [Response.AllParts(toolkit), Response.Part(toolkit), Response.StreamPart(toolkit)]) {
        yield* decode(schema, unknown)
      }
    }))

  it.effect("keeps toolkit-specific validation for known tools", () =>
    Effect.gen(function*() {
      const toolkit = Toolkit.make(
        Tool.make("KnownTool", {
          parameters: Schema.Struct({ value: Schema.Number }),
          success: Schema.Struct({ ok: Schema.Boolean })
        })
      )
      const exit = yield* Effect.exit(
        Schema.decodeUnknownEffect(Response.Part(toolkit))({
          type: "tool-call",
          id: "call_known",
          name: "KnownTool",
          params: { value: "not-a-number" }
        })
      )

      deepStrictEqual(Exit.isFailure(exit), true)
    }))

  it.effect("keeps toolkit-specific validation for known tool results", () =>
    Effect.gen(function*() {
      const toolkit = Toolkit.make(
        Tool.make("KnownTool", {
          parameters: Schema.Struct({ value: Schema.Number }),
          success: Schema.Struct({ ok: Schema.Boolean })
        })
      )
      const exit = yield* Effect.exit(
        Schema.decodeUnknownEffect(Response.Part(toolkit))({
          type: "tool-result",
          id: "call_known",
          name: "KnownTool",
          isFailure: false,
          result: { ok: "not-a-boolean" }
        })
      )

      deepStrictEqual(Exit.isFailure(exit), true)
    }))
})
