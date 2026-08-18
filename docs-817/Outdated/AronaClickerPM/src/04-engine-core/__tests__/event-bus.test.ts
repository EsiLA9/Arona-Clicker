import { describe, it, expect, vi } from "vitest"
import { EventBus, EventTypes } from "../event-bus"

describe("EventBus", () => {
  it("publish delivers event to subscribers of that type", () => {
    const bus = new EventBus()
    const handler = vi.fn()

    bus.subscribe(EventTypes.TickPassed, handler)
    bus.publish(EventTypes.TickPassed, { tick: 42 }, 100)

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith({
      type: EventTypes.TickPassed,
      timestamp: 100,
      data: { tick: 42 },
    })
  })

  it("does not deliver to subscribers of other types", () => {
    const bus = new EventBus()
    const handler = vi.fn()

    bus.subscribe(EventTypes.ResourceAdded, handler)
    bus.publish(EventTypes.TickPassed, { tick: 1 }, 0)

    expect(handler).not.toHaveBeenCalled()
  })

  it("unsubscribe removes the handler", () => {
    const bus = new EventBus()
    const handler = vi.fn()

    const sub = bus.subscribe(EventTypes.TickPassed, handler)
    bus.unsubscribe(sub)
    bus.publish(EventTypes.TickPassed, { tick: 1 }, 0)

    expect(handler).not.toHaveBeenCalled()
  })

  it("subscription.dispose() removes the handler", () => {
    const bus = new EventBus()
    const handler = vi.fn()

    const sub = bus.subscribe(EventTypes.TickPassed, handler)
    sub.dispose()
    bus.publish(EventTypes.TickPassed, { tick: 1 }, 0)

    expect(handler).not.toHaveBeenCalled()
  })

  it("supports multiple subscribers for the same event type", () => {
    const bus = new EventBus()
    const h1 = vi.fn()
    const h2 = vi.fn()

    bus.subscribe(EventTypes.TickPassed, h1)
    bus.subscribe(EventTypes.TickPassed, h2)
    bus.publish(EventTypes.TickPassed, { tick: 1 }, 0)

    expect(h1).toHaveBeenCalledOnce()
    expect(h2).toHaveBeenCalledOnce()
  })

  it("error in one subscriber does not block others", () => {
    const bus = new EventBus()
    const good = vi.fn()
    const bad = vi.fn(() => { throw new Error("boom") })

    bus.subscribe(EventTypes.TickPassed, bad)
    bus.subscribe(EventTypes.TickPassed, good)
    bus.publish(EventTypes.TickPassed, { tick: 1 }, 0)

    expect(good).toHaveBeenCalledOnce()
  })

  it("clear removes all subscribers", () => {
    const bus = new EventBus()
    const h1 = vi.fn()
    const h2 = vi.fn()

    bus.subscribe(EventTypes.TickPassed, h1)
    bus.subscribe(EventTypes.ResourceAdded, h2)
    bus.clear()
    bus.publish(EventTypes.TickPassed, { tick: 1 }, 0)
    bus.publish(EventTypes.ResourceAdded, { resource: "gold", amount: 10, newTotal: 100 }, 0)

    expect(h1).not.toHaveBeenCalled()
    expect(h2).not.toHaveBeenCalled()
  })

  it("publish with typed payloads", () => {
    const bus = new EventBus()
    const handler = vi.fn()

    bus.subscribe(EventTypes.SpotPurchased, handler)
    bus.publish(EventTypes.SpotPurchased, {
      spot: "arona/spot/mine",
      area: "arona/area/hometown",
      level: 1,
      cost: { resource: "gold", amount: 50 },
    }, 50)

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: EventTypes.SpotPurchased,
        timestamp: 50,
        data: expect.objectContaining({ spot: "arona/spot/mine" }),
      }),
    )
  })

  it("handler receives correct payload shape for each event type", () => {
    const bus = new EventBus()
    const storyHandler = vi.fn()
    const areaHandler = vi.fn()

    bus.subscribe(EventTypes.StoryEnded, storyHandler)
    bus.subscribe(EventTypes.AreaEntered, areaHandler)

    bus.publish(EventTypes.StoryEnded, {
      story: "arona/story/prologue",
      ownerKey: "arona/activeStoryEntry/entry_1",
      labels: [1, 3],
    }, 200)

    bus.publish(EventTypes.AreaEntered, {
      area: "arona/area/forest",
      init: "arona/init/main",
    }, 201)

    expect(storyHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ labels: [1, 3] }),
      }),
    )
    expect(areaHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ area: "arona/area/forest" }),
      }),
    )
  })
})
