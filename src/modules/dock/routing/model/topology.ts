import { normalizePath } from "@/foundation/utils";

import { isSamePath } from "../../model/paths";
import type { DockItem, DockTopology, DockTopologyNode } from "../../types";

function getTopologyNodeId(item: DockItem, index: number): string {
  return item?.id || item?.path || item?.name || `dock-node-${index}`;
}

function flattenDockTopology(
  items: DockItem[] | null | undefined,
  parentId: string | null = null,
  depth = 0,
  nodes: DockTopologyNode[] = [],
): DockTopologyNode[] {
  if (!Array.isArray(items)) return nodes;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== "object") continue;

    const id = getTopologyNodeId(item, nodes.length);
    nodes.push({ depth, id, parentId, path: normalizePath(item.path || "") });

    if (item.children) {
      flattenDockTopology(item.children, id, depth + 1, nodes);
    }
  }
  return nodes;
}

function resolveTopologyActiveNode(
  nodes: DockTopologyNode[],
  pathname: string,
): DockTopologyNode | null {
  const normalizedPath = normalizePath(pathname || "");
  return nodes.find((node) => isSamePath(node.path, normalizedPath)) || null;
}

function resolveTopologyAncestors(
  nodes: DockTopologyNode[],
  activeNode: DockTopologyNode | null,
): DockTopologyNode[] {
  if (!activeNode) return [];
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const ancestors: DockTopologyNode[] = [];
  let currentNode: DockTopologyNode | undefined = activeNode;

  while (currentNode?.parentId) {
    currentNode = nodesById.get(currentNode.parentId);
    if (currentNode) ancestors.unshift(currentNode);
  }
  return ancestors;
}

export function createDockTopology(
  items: DockItem[] = [],
  { pathname = "" }: { pathname?: string } = {},
): DockTopology {
  const nodes = flattenDockTopology(items);
  const activePath = normalizePath(pathname || "");
  const activeNode = resolveTopologyActiveNode(nodes, activePath);

  return {
    activeNode,
    activePath,
    ancestors: resolveTopologyAncestors(nodes, activeNode),
    nodes,
  };
}
