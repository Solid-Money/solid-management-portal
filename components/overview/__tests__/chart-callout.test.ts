import { describe, expect, it } from "vitest";
import { placeCallouts } from "@/components/overview/chart-callout";

const item = (key: string, index: number) => ({ key, date: key, text: key, index });

describe("placeCallouts", () => {
  it("moves a nearby label to the second row and keeps far ones on the first", () => {
    const placed = placeCallouts([item("a", 2), item("b", 4), item("c", 20)], 30);
    expect(placed.map((c) => [c.key, c.row])).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 0],
    ]);
  });

  it("drops a later label rather than draw it over two near ones", () => {
    // Two incidents close together, and the best day in the second one's week.
    const placed = placeCallouts(
      [item("incident-1", 10), item("incident-2", 12), item("best", 12)],
      30,
    );
    expect(placed.map((c) => c.key)).toEqual(["incident-1", "incident-2"]);
  });

  it("keeps the more important label when a less important one comes first by index", () => {
    const placed = placeCallouts([item("first", 12), item("second", 14), item("third", 10)], 30);
    expect(placed.map((c) => c.key)).toEqual(["first", "second"]);
  });
});
