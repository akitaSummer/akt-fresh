import { h, options, render } from "/_frsh/preact";

function createRootFragment(parent, replaceNode) {
  replaceNode = [].concat(replaceNode);
  const s = replaceNode[replaceNode.length - 1].nextSibling;
  function insert(c, r) {
    parent.insertBefore(c, r || s);
  }
  return (parent.__k = {
    nodeType: 1,
    parentNode: parent,
    firstChild: replaceNode[0],
    childNodes: replaceNode,
    insertBefore: insert,
    appendChild: insert,
    removeChild: function (c) {
      parent.removeChild(c);
    },
  });
}

const ISLAND_PROPS_COMPONENT = document.getElementById("__FRSH_ISLAND_PROPS");

const ISLAND_PROPS = JSON.parse(ISLAND_PROPS_COMPONENT?.textContent ?? "[]");

export function revive(islands) {
  function walk(node) {
    const tag =
      node.nodeType === 8 && (node.data.match(/^\s*frsh-(.*)\s*$/) || [])[1];
    let endNode = null;
    if (tag) {
      const startNode = node;
      const children = [];
      const parent = node.parentNode;
      while ((node = node.nextSibling) && node.nodeType !== 8) {
        children.push(node);
      }
      startNode.parentNode.removeChild(startNode);

      const [id, n] = tag.split(":");
      render(
        h(islands[id.replace(".mjs", "")], ISLAND_PROPS[Number(n)]),
        createRootFragment(parent, children)
      );
      endNode = node;
    }

    const sib = node.nextSibling;
    const fc = node.firstChild;
    if (endNode) {
      endNode.parentNode?.removeChild(endNode); // remove end tag node
    }

    if (sib) walk(sib);
    if (fc) walk(fc);
  }
  walk(document.body);
}

const originalHook = options.vnode;
options.vnode = (vnode) => {
  if (originalHook) originalHook(vnode);
};
