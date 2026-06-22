import { Platform, createElement } from "react-native";

export const DateInput = ({
  value,
  onChangeText,
  placeholder,
  min,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  min?: string;
}) => {
  if (Platform.OS === "web") {
    return createElement("input", {
      type: "date",
      value: value,
      min: min,
      onChange: (e: any) => onChangeText(e.target.value),
      placeholder: placeholder,
      style: {
        width: "100%",
        padding: "12px",
        fontSize: "16px",
        border: "1px solid #E5E7EB",
        borderRadius: "8px",
        marginBottom: "12px",
        boxSizing: "border-box",
        fontFamily: "inherit",
        color: "#111827",
      },
    });
  }

  // Fallback for native if a native date picker isn't implemented here yet.
  // We can just use a normal text input or another placeholder since it was like this.
  const { TextInput } = require("react-native");
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      style={{
        width: "100%",
        padding: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 8,
        marginBottom: 12,
        color: "#111827",
      }}
    />
  );
};
