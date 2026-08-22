import "react-native";

declare module "react-native" {
  interface PressableStateCallbackType {
    /** React Native Web hover state (not present in native React Native typings). */
    hovered?: boolean;
  }
}
