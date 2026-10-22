import { createBlockSpec, defaultProps } from "@blocknote/core";

import { calloutVariantSchema } from "@bebranded/elearning-core";

/**
 * Callout: a tinted box that highlights a tip or a warning. Our own block
 * (spec 02, editor package); its JSON shape is validated by
 * `validateLessonDocument` in elearning-core.
 */
export const createCalloutBlock = createBlockSpec(
  {
    type: "callout",
    propSchema: {
      backgroundColor: defaultProps.backgroundColor,
      textColor: defaultProps.textColor,
      variant: { default: "info", values: calloutVariantSchema.options },
    },
    content: "inline",
  },
  {
    render: (block) => {
      const dom = document.createElement("div");
      dom.className = "el-callout";
      dom.dataset.variant = block.props.variant;
      dom.setAttribute("role", "note");
      const contentDOM = document.createElement("div");
      contentDOM.className = "el-callout-content";
      dom.append(contentDOM);
      return { dom, contentDOM };
    },
  },
);
