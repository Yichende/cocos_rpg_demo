import { _decorator, Component, Node, Label, instantiate, UITransform } from "cc";
import { ItemConfigTable } from "../../Data/ItemConfig";

const { ccclass, property } = _decorator;

@ccclass("ItemDetail")
export class ItemDetail extends Component {
  @property(Node)
  icon: Node = null!;

  @property(Label)
  nameLabel: Label = null!;

  @property(Label)
  descLabel: Label = null!;

  @property(Label)
  countLabel: Label = null!;

  private currentItemId: number | null = null;
  private currentCount: number = 0;

  clear() {
    this.currentItemId = null;
    this.currentCount = 0;

    this.icon.removeAllChildren();
    this.nameLabel.string = "";
    this.descLabel.string = "";
    this.countLabel.string = "";
  }

  show(itemId: number, count: number) {
    const iconConfig = ItemConfigTable.get(itemId);
    if (!iconConfig || !iconConfig.iconPrefab) {
      console.warn(`[ItemDetail] 物品配置未就绪: ${itemId}`);
      return;
    }

    this.currentItemId = itemId;
    this.currentCount = count;

    // 显示物品信息
    this.icon.removeAllChildren();
    const iconNode = instantiate(iconConfig.iconPrefab);
    iconNode.setParent(this.icon);

    const parentUI = this.icon.getComponent(UITransform)!;
    const iconUI = iconNode.getComponent(UITransform)!;

    const padding = 0.3;
    const targetSize = Math.min(parentUI.width, parentUI.height) * (1 - padding);

    iconUI.setContentSize(targetSize, targetSize);

    iconNode.setPosition(0, 0, 0);

    this.nameLabel.string = iconConfig.name;
    this.descLabel.string = iconConfig.desc;
    this.countLabel.string = `数量：${count}`;
  }
}