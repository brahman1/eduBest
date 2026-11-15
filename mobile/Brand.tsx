import React from "react";
import { Image, ImageStyle, StyleProp } from "react-native";

export default function Brand({
  width = 190,
  light = false,
  mark = false,
  style,
}: {
  width?: number;
  light?: boolean;
  mark?: boolean;
  style?: StyleProp<ImageStyle>;
}) {
  const source = mark
    ? light
      ? require("./assets/edubest-mark-light.png")
      : require("./assets/edubest-mark.png")
    : light
      ? require("./assets/edubest-logo-light.png")
      : require("./assets/edubest-logo.png");
  return (
    <Image
      source={source}
      accessibilityLabel="EduBest"
      resizeMode="contain"
      style={[{ width, height: mark ? width : width / 5 }, style]}
    />
  );
}
