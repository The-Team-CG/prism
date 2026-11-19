"use client";

import type { PrismTableNode } from "@prism/types";
import { FABRICS, FABRIC_NAMES, type Fabric } from "../dressing";
import { usePrismFloorplan } from "../editor-context";

type ClothKey = "linen" | "sash" | "overlay";
type FieldProps = { node: PrismTableNode; onUpdate: (patch: Partial<PrismTableNode>) => void };

const titled = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

const swatch =
  "size-[18px] rounded-full shadow-[inset_0_0_0_1px_rgb(24_19_26/0.14)] aria-checked:shadow-[inset_0_0_0_1px_rgb(24_19_26/0.14),0_0_0_2px_var(--background),0_0_0_3.5px_var(--foreground)] disabled:cursor-default";

/** "None": a white swatch struck through, for a cloth that can be left off. */
const NONE_FILL = "linear-gradient(135deg, #fff 45%, #c9c1c6 45%, #c9c1c6 55%, #fff 55%)";

/**
 * A cloth colour as a row of swatches, as a planner picks linen from a sample card. Linen is always on the table; a
 * sash or an overlay can be left off. The colour's name shows beside the row.
 */
export function swatchField(key: ClothKey, label: string) {
  const optional = key !== "linen";
  const choices: ReadonlyArray<"none" | Fabric> = optional ? ["none", ...FABRIC_NAMES] : FABRIC_NAMES;
  function SwatchField({ node, onUpdate }: FieldProps) {
    const { readOnly } = usePrismFloorplan();
    const value = node[key] ?? "none";
    const pick = (choice: "none" | Fabric) => onUpdate({ [key]: choice === "none" ? undefined : choice } as Partial<PrismTableNode>);
    return (
      <div className="flex items-start justify-between gap-3 px-3 py-1.5">
        <span className="pt-0.5 text-xs text-foreground/80">
          {label}
          <span className="block text-[11px] text-muted-foreground">{titled(value)}</span>
        </span>
        <div role="radiogroup" aria-label={label} className="grid grid-cols-6 gap-1.5">
          {choices.map((choice) => (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={value === choice}
              aria-label={titled(choice)}
              title={titled(choice)}
              disabled={readOnly}
              onClick={() => pick(choice)}
              className={swatch}
              style={{ background: choice === "none" ? NONE_FILL : FABRICS[choice].fill }}
            />
          ))}
        </div>
      </div>
    );
  }
  SwatchField.displayName = `SwatchField(${key})`;
  return SwatchField;
}
