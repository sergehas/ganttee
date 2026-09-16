import { IconName } from "@common/icons";
import * as vscode from "vscode";

/** Returns light and dark custom SVG URIs for a host-rendered icon. */
export function customIconPath(extensionUri: vscode.Uri, name: IconName): vscode.IconPath {
  const iconDirectory = vscode.Uri.joinPath(extensionUri, "media", "icons");
  return {
    light: vscode.Uri.joinPath(iconDirectory, "light", `${name}.svg`),
    dark: vscode.Uri.joinPath(iconDirectory, "dark", `${name}.svg`),
  };
}
