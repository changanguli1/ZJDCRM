import { describe, expect, it } from "vitest";
import { normalizeCompanyName, isValidMobile } from "../../server/shared/normalize-company";

describe("normalizeCompanyName", () => {
  it("trims leading and trailing spaces", () => {
    expect(normalizeCompanyName("  上海星辰科技  ")).toBe("上海星辰科技");
  });

  it("normalizes full-width characters", () => {
    expect(normalizeCompanyName("上海　星辰　科技")).toBe("上海 星辰 科技");
  });

  it("lowercases Latin letters", () => {
    expect(normalizeCompanyName("ABC科技有限公司")).toBe("abc科技");
  });

  it("strips 有限公司 suffix", () => {
    expect(normalizeCompanyName("上海星辰科技有限公司")).toBe("上海星辰科技");
  });

  it("strips Chinese parentheses with content at the end", () => {
    expect(normalizeCompanyName("上海星辰科技（有限责任公司）")).toBe("上海星辰科技");
  });

  it("strips English parentheses with content at the end", () => {
    expect(normalizeCompanyName("上海星辰科技(有限责任公司)")).toBe("上海星辰科技");
  });

  it("strips 集团 suffix", () => {
    expect(normalizeCompanyName("星辰科技集团")).toBe("星辰科技");
  });

  it("handles complex cases", () => {
    expect(normalizeCompanyName("  北京　星辰科技有限公司（集团）  ")).toBe("北京 星辰科技");
  });

  it("does not strip non-suffix text", () => {
    const result = normalizeCompanyName("上海医疗器械研究所");
    expect(result).toBe("上海医疗器械研究所");
    // "研究所" should not strip "所" (there's no single-char "所" suffix in the list)
  });
});

describe("isValidMobile", () => {
  it("returns true for valid mobile numbers", () => {
    expect(isValidMobile("13800138000")).toBe(true);
    expect(isValidMobile("15912345678")).toBe(true);
  });

  it("returns false for invalid mobile numbers", () => {
    expect(isValidMobile("12345678901")).toBe(false);
    expect(isValidMobile("1380013800")).toBe(false);
    expect(isValidMobile("138001380000")).toBe(false);
    expect(isValidMobile("abc")).toBe(false);
  });
});
