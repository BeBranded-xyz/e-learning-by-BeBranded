import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { csvResponse, toCsv } from "./csv.js";

describe("toCsv", () => {
  it("writes a header and rows with CRLF line endings", () => {
    expect(
      toCsv(
        ["a", "b"],
        [
          ["x", 1],
          [null, true],
        ],
      ),
    ).toBe("a,b\r\nx,1\r\n,true\r\n");
  });

  it.each([
    ["a comma", "a,b", '"a,b"'],
    ["a quote", 'say "hi"', '"say ""hi"""'],
    ["a line break", "one\ntwo", '"one\ntwo"'],
    ["a carriage return", "one\rtwo", '"one\rtwo"'],
  ])("quotes %s", (_label, value, expected) => {
    expect(toCsv(["v"], [[value]])).toBe(`v\r\n${expected}\r\n`);
  });

  it.each(["=SUM(A1)", "+1", "-1+2", "@cmd", "\tx", '=HYPERLINK("http://x")'])(
    "neutralizes the formula %s",
    (value) => {
      const line = toCsv(["v"], [[value]]).split("\r\n")[1] ?? "";

      expect(line.replace(/^"/, "").startsWith("'")).toBe(true);
    },
  );

  it("keeps negative numbers as numbers", () => {
    expect(toCsv(["v"], [[-1]])).toBe("v\r\n-1\r\n");
  });

  it("round-trips any string through a simple RFC 4180 reader", () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const line = toCsv(["v"], [[value]]).slice(3, -2);
        const unquoted =
          line.startsWith('"') && line.endsWith('"')
            ? line.slice(1, -1).replaceAll('""', '"')
            : line;
        const expected = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
        expect(unquoted).toBe(expected);
      }),
    );
  });
});

describe("csvResponse", () => {
  it("is a non-cached CSV attachment with the request id", () => {
    const response = csvResponse("a\r\n", "report.csv", "req-1");

    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="report.csv"');
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBe("req-1");
  });
});
