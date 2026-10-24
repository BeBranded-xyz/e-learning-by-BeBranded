import { AlignmentType, LevelFormat } from "docx";
import type { INumberingOptions } from "docx";

const LEVELS = 9;
const BULLETS = ["•", "◦", "▪"] as const;

/**
 * Word numbering definitions (spec 10: "Word numbering definitions"). Each
 * numbered list gets its own instance, so it restarts at its own start.
 */
export class NumberingRegistry {
  private readonly starts = new Set<number>();
  private instance = 0;

  bullet(level: number) {
    return { reference: "el-bullet", level: Math.min(level, LEVELS - 1) };
  }

  numbered(start: number, level: number) {
    this.starts.add(start);
    this.instance += 1;
    return {
      reference: `el-numbered-${start}`,
      level: Math.min(level, LEVELS - 1),
      instance: this.instance,
    };
  }

  config(): INumberingOptions {
    const indent = (level: number) => ({
      paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } },
    });
    const bullet = {
      reference: "el-bullet",
      levels: Array.from({ length: LEVELS }, (_, level) => ({
        level,
        format: LevelFormat.BULLET,
        text: BULLETS[level % BULLETS.length] ?? "•",
        alignment: AlignmentType.START,
        style: indent(level),
      })),
    };
    const numbered = [...this.starts].map((start) => ({
      reference: `el-numbered-${start}`,
      levels: Array.from({ length: LEVELS }, (_, level) => ({
        level,
        format: LevelFormat.DECIMAL,
        text: `%${level + 1}.`,
        start: level === 0 ? start : 1,
        alignment: AlignmentType.START,
        style: indent(level),
      })),
    }));
    return { config: [bullet, ...numbered] };
  }
}
