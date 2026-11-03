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

  it("moves a label down when its box would overlap on a narrow plot", () => {
    const text = "Oct 27 · $12.4K · best day since Oct 12";
    const at = (key: string, index: number) => ({ key, date: key, text, index });
    // A phone-width plot: bars 2 and 20 of 30 are far apart by count, not by pixels.
    const narrow = placeCallouts([at("a", 2), at("b", 20)], 30, 320);
    expect(narrow.map((c) => c.row)).toEqual([0, 1]);
    // A desktop plot has room for both on the first row.
    const wide = placeCallouts([at("a", 2), at("b", 20)], 30, 900);
    expect(wide.map((c) => c.row)).toEqual([0, 0]);
  });
});
