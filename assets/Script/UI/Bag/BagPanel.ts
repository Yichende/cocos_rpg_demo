import { _decorator, Component, Node } from 'cc';
import { BagSlot } from './BagSlot';
import { ItemDetail } from './ItemDetail';
import { InventoryRepository } from '../../Repository/InventoryRepository';

const { ccclass, property } = _decorator;

@ccclass('BagPanel')
export class BagPanel extends Component {

  @property(Node)
  bagContent: Node = null!;

  @property(ItemDetail)
  itemDetail: ItemDetail = null!;

  slots: BagSlot[] = [];
  private selectedSlot: BagSlot | null = null;
  private bag: InventoryRepository | null = null;


  onLoad() {
    const children = this.bagContent.children;

    this.slots = children.map((node, index) => {
      const slot = node.getComponent(BagSlot)!;
      slot.index = index;
      slot.onClick = this.onSlotClick.bind(this);
      return slot;
    });
  }

  setInventory(bag: InventoryRepository) {
    this.bag = bag;
    console.log('[BagPanel] inventory set:', bag.items)
    this.refresh();
  }

  refresh() {
    if (!this.bag) return;

    // 清空所有slot
    this.slots.forEach(slot => slot.clear());

    // 获取背包数据
    const items = this.bag.items;

    // 填充slot
    items.forEach((item, index) => {
      if (index >= this.slots.length) return;
      this.slots[index].setItem(item.itemId, item.count);
    })

    console.log('[BagPanel] refresh done');
  }

  getSlot(index: number): BagSlot | null {
    return this.slots[index] ?? null;
  }

  private clearSelection() {
    this.selectedSlot = null;
    this.itemDetail.clear();
  }

  private selectSlot(slot: BagSlot) {
    if (this.selectedSlot === slot) return;
    this.selectedSlot = slot;
    this.itemDetail.show(slot.itemId!, slot.count);
  }

  private onSlotClick(slot: BagSlot) {
    // 点击空格子
    if (slot.isEmpty()) {
      this.clearSelection();
      return;
    }
    this.selectSlot(slot)
  }

}
