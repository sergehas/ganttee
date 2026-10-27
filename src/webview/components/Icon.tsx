import { IconName } from "@common/icons";
import "@webview/components/Icon.scss";
import { createContext, type CSSProperties, type ReactNode, useContext } from "react";

const IconBaseUriContext = createContext<string | null>(null);

interface IconBaseUriProviderProps {
  /** Host-converted base URI for the bundled icon directory. */
  readonly baseUri: string;
  /** Webview content that can resolve custom icons. */
  readonly children: ReactNode;
}

interface IconProps {
  /** Name of the bundled SVG without its file extension. */
  readonly name: IconName;
}

/** Supplies the host-converted URI used to resolve custom webview icons. */
export function IconBaseUriProvider({
  baseUri,
  children,
}: IconBaseUriProviderProps): React.JSX.Element {
  return <IconBaseUriContext.Provider value={baseUri}>{children}</IconBaseUriContext.Provider>;
}

/** Renders one of the extension's monochrome SVG icons. */
export function Icon({ name }: IconProps): React.JSX.Element {
  const baseUri = useContext(IconBaseUriContext);
  const iconUri = baseUri ? `${baseUri}/${name}.svg` : undefined;
  const style: CSSProperties | undefined = iconUri
    ? ({ "--ganttee-icon-mask": `url("${iconUri}")` } as CSSProperties)
    : undefined;

  return <span className="ganttee-icon" aria-hidden="true" style={style} />;
}
