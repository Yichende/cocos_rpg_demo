import { _decorator, Component, Sprite, Label } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ItemIcon')
export class ItemIcon extends Component {

  @property(Sprite)
  icon: Sprite = null!;

  @property(Label)
  countLabel: Label = null!;

  setCount(count: number) {
    this.countLabel.string = count > 1 ? String(count) : '';
  }
}
