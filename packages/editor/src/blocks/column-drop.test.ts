import { describe, expect, it } from "vitest";

import { EDGE_SHARE, dropSide, planColumnDrop } from "./column-drop.js";
import type { PlanBlock } from "./column-drop.js";

const block = (id: string, children: PlanBlock[] = [], type = "paragraph"): PlanBlock => ({
  id,
  type,
  children,
});
const column = (id: string, children: PlanBlock[]) => block(id, children, "column");
const list = (id: string, columns: PlanBlock[]) => block(id, columns, "columnList");

describe("dropSide", () => {
  const rect = { left: 100, width: 500 };

  it.each([
    [100, "left"],
    [100 + 500 * EDGE_SHARE - 1, "left"],
    [350, null],
    [600 - 500 * EDGE_SHARE + 1, "right"],
    [600, "right"],
    [99, null],
    [601, null],
  ])("at x=%d answers %s", (x, side) => {
    expect(dropSide(rect, x)).toBe(side);
  });

  it("has no edge on an element without width", () => {
    expect(dropSide({ left: 0, width: 0 }, 0)).toBeNull();
  });
});

describe("planColumnDrop", () => {
  it("makes two columns, the dropped blocks on the edge's side", () => {
    expect(planColumnDrop(block("t"), [block("a"), block("b")], "right")).toEqual({
      kind: "create",
      targetId: "t",
      columns: [["t"], ["a", "b"]],
    });
    expect(planColumnDrop(block("t"), [block("a")], "left")?.columns).toEqual([["a"], ["t"]]);
  });

  it("keeps a block's own children with it", () => {
    expect(
      planColumnDrop(block("t", [block("t1")]), [block("a", [block("a1")])], "right")?.columns,
    ).toEqual([["t"], ["a"]]);
  });

  it("adds a column to a column list, on the edge's side", () => {
    const target = list("l", [column("c1", [block("x")]), column("c2", [block("y"), block("z")])]);

    expect(planColumnDrop(target, [block("a")], "left")).toEqual({
      kind: "add",
      targetId: "l",
      columns: [["a"], ["x"], ["y", "z"]],
    });
    expect(planColumnDrop(target, [block("a")], "right")?.columns).toEqual([
      ["x"],
      ["y", "z"],
      ["a"],
    ]);
  });

  it.each([
    ["nothing dragged", block("t"), []],
    [
      "a column list dragged",
      block("t"),
      [list("l", [column("c", [block("x")]), column("d", [block("y")])])],
    ],
    ["a block holding a column list dragged", block("t"), [block("a", [list("l", [])])]],
    ["the target itself", block("t"), [block("t")]],
    ["a parent of the target", block("t"), [block("a", [block("t")])]],
    ["a child of the target", block("t", [block("a")]), [block("a")]],
    [
      "a block of the target list",
      list("l", [column("c", [block("a")]), column("d", [block("b")])]),
      [block("a")],
    ],
    ["a column as target", column("c", [block("x")]), [block("a")]],
    ["a target holding a column list", block("t", [list("l", [])]), [block("a")]],
    [
      "a full column list",
      list(
        "l",
        ["1", "2", "3", "4"].map((id) => column(id, [block(`b${id}`)])),
      ),
      [block("a")],
    ],
  ])("stays an ordinary drop for %s", (_label, target, dragged) => {
    expect(planColumnDrop(target, dragged, "right")).toBeNull();
  });
});
