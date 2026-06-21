type ImportRow = {
  title: string;
  companyName: string;
  sourceCode?: string;
  desiredArea?: number;
  industryCode?: string;
  mainBusiness?: string;
};

function parseLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

export function parseClueCsv(text: string): ImportRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseLine(lines[0]);
  const index = (name: string) => headers.indexOf(name);

  return lines.slice(1).map((line) => {
    const cells = parseLine(line);
    const desiredArea = Number(cells[index("需求面积")]);
    return {
      title: cells[index("线索名称")] || "",
      companyName: cells[index("企业名称")] || "",
      ...(index("渠道来源") >= 0 && cells[index("渠道来源")] ? { sourceCode: cells[index("渠道来源")] } : {}),
      ...(index("需求面积") >= 0 && Number.isFinite(desiredArea) ? { desiredArea } : {}),
      ...(index("行业") >= 0 && cells[index("行业")] ? { industryCode: cells[index("行业")] } : {}),
      ...(index("主营业务") >= 0 && cells[index("主营业务")] ? { mainBusiness: cells[index("主营业务")] } : {}),
    };
  });
}
