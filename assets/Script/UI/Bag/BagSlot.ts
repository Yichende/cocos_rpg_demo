import {
  _decorator,
  Component,
  EventTouch,
  instantiate,
  Node,
  resources,
  Prefab,
  UITransform,
} from "cc";
import { ItemConfigTable } from "../../Data/ItemConfig";

const { ccclass, property } = _decorator;

@ccclass("BagSlot")
export class BagSlot extends Component {
  @property(Node)
  itemRoot: Node = null!;

  @property(Node)
  bg: Node = null!;

  index: number = -1; // 格子索引
  itemId: number | null = null;
  count: number = 0;

  private handleClick(_e: EventTouch) {
    if (this.onClick) {
      this.onClick(this);
    }
  }

  onClick: ((slot: BagSlot) => void) | null = null;

  protected onLoad(): void {
    if (!this.itemRoot) {
      console.error(`[BagSlot] itemRoot 未绑定，节点：${this.node.name}`);
      return;
    }
    this.node.on(Node.EventType.TOUCH_END, this.handleClick, this);
  }

  protected onDestroy(): void {
    this.node.off(Node.EventType.TOUCH_END, this.handleClick, this);
  }

  isEmpty(): boolean {
    return this.itemId === null;
  }

  clear() {
    this.itemId = null;
    this.count = 0;

    if (!this.itemRoot) return;
    this.itemRoot.removeAllChildren();
  }

  setItem(itemId: number, count: number) {
    const config = ItemConfigTable.get(itemId);
    console.log("[BagSlot] setItem", itemId, "config =", config);

    if (!config || !config.iconPath) {
      console.warn("物品配置或 prefab 未就绪:", itemId);
      return;
    }

    this.itemId = itemId;
    this.count = count;

    // 清空旧 icon
    this.itemRoot.removeAllChildren();

    // ⭐ 正确加载 prefab
    resources.load(config.iconPath, Prefab, (err, prefab) => {
      if (err) {
        console.error("加载物品 icon 失败:", config.iconPath, err);
        return;
      }

      const iconNode = instantiate(prefab);
      iconNode.setParent(this.itemRoot);

      const bgUI = this.bg.getComponent(UITransform)!;
      const iconUI = iconNode.getComponent(UITransform)!;

      const padding = 0.3;
      const targetSize = Math.min(bgUI.width, bgUI.height) * (1 - padding);

      iconUI.setContentSize(targetSize, targetSize);

      iconNode.setPosition(0, 0, 0);
      iconNode.setScale(1, 1, 1);
    });
  }
}
