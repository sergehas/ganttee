# Tips and tricks

## Generating `png` icon for `package.json`

```shell
resvg -w 128 ./media/ganttee-color.svg ./media/gantee-color.png
```

## building new icons

"base graphical components" are in [base-shape.svg](./base-shape.svg)

### webview icons

in [media/icons](../../media/icons)

```xml
<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
  <path d="...">
</svg>
```

### host icons

- light theme: [media/icons/light](../../media/icons/light)

  ```xml
  <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="#424242">
    <path fill-rule="evenodd" clip-rule="evenodd"
      d="...">
  </svg>
  ```

- dark theme: [media/icons/dark](../../media/icons/dark)

  ```xml
  <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="#c5c5c5">
    <path fill-rule="evenodd" clip-rule="evenodd"
      d="...">
  </svg>
  ```

### Producing `svg`

#### Cleaning `svg` files

Run SVGO first, then normalize any SVG to the webview icon template. The XSLT keeps the SVG content,
sets the required root attributes, and removes child `fill` and `style` attributes so `currentColor`
can flow from the root:

```shell
npx --yes svgo --multipass input.svg -o input.min.svg
```

#### Generating well colored `svg` webview icons

uses [`themed-icon.xsl`](../../scripts/icons/themed-icon.xsl) to transform:

```shell
npx --yes xslt3 "-xsl:./scripts/icons/themed-icon.xsl" "-s:input.min.svg" "-o:./media/icons/icon.svg"
```

`xsltproc` alternative:

```shell
xsltproc --stringparam color "currentColor" ./scripts/icons/themed-icon.xsl input.min.svg > ./media/icons/icon.svg
```

#### Generating themed `svg` host icons

Convert a webview icon to a host icon with a theme-specific fill. uses
[`themed-icon.xsl`](./scripts/icons/themed-icon.xsl) to transform: generate light and dark host
icons:

```shell
npx --yes xslt3 "-xsl:./scripts/icons/themed-icon.xsl" "-s:./media/icons/icon.svg" "-o:./media/icons/light/icon.svg" "color=#424242"
npx --yes xslt3 "-xsl:./scripts/icons/themed-icon.xsl" "-s:./media/icons/icon.svg" "-o:./media/icons/dark/icon.svg" "color=#c5c5c5"
```

`xsltproc` alternative:

```shell
xsltproc --stringparam color "#424242" ./scripts/icons/themed-icon.xsl ./media/icons/icon.svg > ./media/icons/light/icon.svg
xsltproc --stringparam color "#c5c5c5" ./scripts/icons/themed-icon.xsl ./media/icons/icon.svg > ./media/icons/dark/icon.svg
```
