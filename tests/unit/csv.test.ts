import { describe, expect, it } from "vitest";
import { parseClueCsv } from "../../src/lib/csv";

describe("parseClueCsv", () => {
  it("maps Chinese headers and quoted values into import rows", () => {
    const rows = parseClueCsv(
      "线索名称,企业名称,渠道来源,需求面积\r\n" +
      "\"重点,项目\",示例科技,activity,1200",
    );

    expect(rows).toEqual([
      {
        title: "重点,项目",
        companyName: "示例科技",
        sourceCode: "activity",
        desiredArea: 1200,
      },
    ]);
  });
});
