import { Schema } from "effect"
import { Response, Tool, Toolkit } from "effect/unstable/ai"
import { describe, expect, it } from "tstyche"

const KnownTool = Tool.make("KnownTool", {
  parameters: Schema.Struct({ value: Schema.Number }),
  success: Schema.Struct({ ok: Schema.Boolean })
})

const toolkit = Toolkit.make(KnownTool)
type Tools = Toolkit.Tools<typeof toolkit>
const allParts = Response.AllParts(toolkit)
const part = Response.Part(toolkit)
const streamPart = Response.StreamPart(toolkit)

describe("Response", () => {
  it("includes unrestricted tool parts in response models", () => {
    expect<Response.AnyToolCallPart>().type.toBeAssignableTo<Schema.Schema.Type<typeof allParts>>()
    expect<Response.AnyToolResultPart>().type.toBeAssignableTo<Schema.Schema.Type<typeof part>>()
    expect<Response.AnyToolCallPart>().type.toBeAssignableTo<Schema.Schema.Type<typeof streamPart>>()
  })

  it("provides result service aliases for tool records", () => {
    expect(part).type.toBeAssignableTo<
      Schema.Codec<
        Schema.Schema.Type<typeof part>,
        Schema.Codec.Encoded<typeof part>,
        Tool.ResultDecodingServicesFor<Tools>,
        Tool.ResultEncodingServicesFor<Tools>
      >
    >()
  })
})
