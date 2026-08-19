import React, { useMemo } from "react";
import { GenericDirectiveEditor } from "@mdxeditor/editor";

// 卡片容器
export const CardDirectiveEditor: React.FC<any> = (props) => {
  const type = props.mdastNode?.attributes?.type || "default";
  const title = props.mdastNode?.attributes?.title || "";
  const typeColors: Record<
    string,
    { border: string; bg: string; titleColor: string }
  > = {
    default: { border: "#e8e8e8", bg: "#fff", titleColor: "rgba(0,0,0,0.88)" },
    info: { border: "#91caff", bg: "#e6f4ff", titleColor: "#0958d9" },
    success: { border: "#b7eb8f", bg: "#f6ffed", titleColor: "#389e0d" },
    warning: { border: "#ffe58f", bg: "#fffbe6", titleColor: "#d48806" },
    error: { border: "#ffa39e", bg: "#fff1f0", titleColor: "#cf1322" },
  };
  const colors = typeColors[type] || typeColors.default;

  return (
    <div
      className="directive-card"
      style={{
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        borderRadius: "8px",
        margin: "16px 0",
        overflow: "hidden",
      }}
    >
      {title && (
        <div
          style={{
            padding: "10px 16px",
            fontWeight: 600,
            color: colors.titleColor,
            borderBottom: `1px solid ${colors.border}`,
            fontSize: "15px",
          }}
        >
          {title}
        </div>
      )}
      <div style={{ padding: "12px 16px" }}>
        <GenericDirectiveEditor {...props} />
      </div>
    </div>
  );
};
