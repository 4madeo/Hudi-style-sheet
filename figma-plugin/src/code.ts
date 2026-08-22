type InsertOrbMessage = {
  type: "insert-orb";
  svg: string;
  name: string;
};

type PluginMessage = InsertOrbMessage;

figma.showUI(__html__, {
  width: 420,
  height: 640,
  themeColors: true,
  title: "HUDI Orb Library",
});

function insertOrb(svg: string, name: string, x: number, y: number) {
  const node = figma.createNodeFromSvg(svg);
  node.name = name;
  figma.currentPage.appendChild(node);
  node.x = x - node.width / 2;
  node.y = y - node.height / 2;
  figma.currentPage.selection = [node];
  return node;
}

figma.ui.onmessage = (message: PluginMessage) => {
  if (message.type !== "insert-orb") return;

  try {
    const centre = figma.viewport.center;
    const node = insertOrb(message.svg, message.name, centre.x, centre.y);
    figma.viewport.scrollAndZoomIntoView([node]);
    figma.ui.postMessage({ type: "inserted", name: message.name });
    figma.notify(`${message.name} inserted`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown import error";
    figma.ui.postMessage({ type: "insert-error", detail });
    figma.notify("The orb could not be inserted", { error: true });
  }
};

figma.on("drop", (event) => {
  const svgItem = event.items.find((item) => item.type === "image/svg+xml");
  if (!svgItem) return true;

  try {
    const metadata = event.dropMetadata as { name?: unknown } | undefined;
    const name = typeof metadata?.name === "string" ? metadata.name : "HUDI Orb";
    insertOrb(svgItem.data, name, event.absoluteX, event.absoluteY);
    figma.notify(`${name} inserted`);
  } catch (error) {
    console.error("Unable to import dropped HUDI orb", error);
    figma.notify("The orb could not be inserted", { error: true });
  }

  return false;
});
