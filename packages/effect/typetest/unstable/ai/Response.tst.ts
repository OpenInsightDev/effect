import { Schema } from "effect"
import { Response, Tool, Toolkit } from "effect/unstable/ai"
import { describe, expect, it } from "tstyche"

const KnownTool = Tool.make("KnownTool", {
  parameters: Schema.Struct({ value: Schema.Number }),
  success: Schema.Struct({ ok: Schema.Boolean })
})

const toolkit = Toolkit.make(KnownTool)
type Tools = Toolkit.Tools<typeof toolkit>

describe("Response", () => {
  it("keeps toolkit-specific response types unchanged", () => {
    expect<Schema.Schema.Type<ReturnType<typeof Response.AllParts<typeof toolkit>>>>().type.toBe<
      Response.AllParts<Tools>
    >()
    expect<Schema.Schema.Type<ReturnType<typeof Response.Part<typeof toolkit>>>>().type.toBe<Response.Part<Tools>>()
    expect<Schema.Schema.Type<ReturnType<typeof Response.StreamPart<typeof toolkit>>>>().type.toBe<
      Response.StreamPart<Tools>
    >()
    expect<Response.AnyToolCallPart>().type.not.toBeAssignableTo<Response.Part<Tools>>()
    expect<Response.AnyToolResultPart>().type.not.toBeAssignableTo<Response.StreamPart<Tools>>()
  })

  it("adds unrestricted tools only to any response types", () => {
    const allParts = Response.AnyAllParts(toolkit)
    const part = Response.AnyPart(toolkit)
    const streamPart = Response.AnyStreamPart(toolkit)

    expect<Response.AnyToolCallPart>().type.toBeAssignableTo<Response.AnyAllParts<Tools>>()
    expect<Response.AnyToolResultPart>().type.toBeAssignableTo<Response.AnyStreamPart<Tools>>()
    expect<Response.AnyToolCallPart>().type.toBeAssignableTo<Schema.Schema.Type<typeof allParts>>()
    expect<Response.AnyToolResultPart>().type.toBeAssignableTo<Schema.Schema.Type<typeof part>>()
    expect<Response.AnyToolCallPart>().type.toBeAssignableTo<Schema.Schema.Type<typeof streamPart>>()
  })
})
