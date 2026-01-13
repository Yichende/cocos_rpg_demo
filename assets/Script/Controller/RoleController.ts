import {
  _decorator,
  Component,
  EventKeyboard,
  Node,
  input,
  Input,
  KeyCode,
  Animation,
  Vec2,
  Collider2D,
  Contact2DType,
  PhysicsSystem2D,
  RigidBody2D,
  EPhysics2DDrawFlags,
} from "cc";

import { FogOfWarController } from "./FogOfWarController";
const { ccclass, property } = _decorator;

@ccclass("RoleController")
export class RoleController extends Component {

  @property
  EPhysics2DDrawVisable: boolean = false;

  @property({ type: Node, tooltip: "角色视野阴影节点" })
  shadowNode: Node | null = null;

  @property({ type: FogOfWarController })
  fogController: FogOfWarController | null = null;

  private _keyState: Record<number, boolean> = {};
  private _anim: Animation | null = null;
  private _curAnim = "";
  private _speed = 10;
  private _movable = true;

  private _collider: Collider2D | null = null;
  private _rb: RigidBody2D | null = null;

  public setMovable(value: boolean) {
    console.log("[RoleController] setMovable:", value);
    this._movable = value;
  
    if (!value) {
      // 清空所有按键状态（防止残留）
      this._keyState = {};
  
      // 立即停止刚体运动（最关键）
      if (this._rb) {
        this._rb.linearVelocity = Vec2.ZERO;
        this._rb.angularVelocity = 0;
        this._rb.sleep(); // 让物理系统直接休眠（推荐）
      }
  
      // 停止动画
      this.playAnim("");
    } else {
      // 恢复时唤醒刚体
      if (this._rb) {
        this._rb.wakeUp();
      }
    }
  }
  

  private playAnim(name: string) {
    if (!this._anim) return;

    // stop
    if (name === "") {
      if (this._curAnim !== "") {
        this._anim.stop();
        this._curAnim = "";
      }
      return;
    }

    // 不重复播同一动画loop
    if (this._curAnim === name) return;

    //play
    this._anim.play(name);
    this._curAnim = name;
  }

  private playMoveAnim(dirX: number, dirY: number) {
    let animName = "";

    if (Math.abs(dirX) > Math.abs(dirY)) {
      animName = dirX > 0 ? "walk_right" : "walk_left";
    } else {
      animName = dirY > 0 ? "walk_up" : "walk_down";
    }

    this.playAnim(animName);
  }

  private onBeginContact(self: Collider2D, other: Collider2D) {
    // if (other.group === PhysicsGroup.WALL) {
    //   用于音效 / 震动 / 其他状态
    // }
  }

  private onEndContact(self: Collider2D, other: Collider2D) {}


  public setShadowVisible(visible: boolean) {
    if (!this.shadowNode) return;
    this.shadowNode.active = visible;
  }
  

  start() {
    // 显示碰撞
    if (this.EPhysics2DDrawVisable) {
      PhysicsSystem2D.instance.debugDrawFlags =
      EPhysics2DDrawFlags.Shape | EPhysics2DDrawFlags.Aabb;
    }
  }

  protected onLoad(): void {
    this._anim = this.getComponentInChildren(Animation);

    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this.onKeyUp, this);

    this._collider = this.getComponent(Collider2D);
    this._rb = this.getComponent(RigidBody2D);
    if (this._collider) {
      this._collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
      this._collider.on(Contact2DType.END_CONTACT, this.onEndContact, this);
    }
    if (!this._rb) {
      console.error("RoleController: 缺少 Rigidbody2D");
    }

  }

  protected onDestroy(): void {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
  }

  update(dt: number) {
    if (!this._movable) return;
    // console.log("movable: ", this._movable);
    if (!this._rb) return;
    let dirX = 0;
    let dirY = 0;

    if (this._keyState[KeyCode.KEY_W]) {
      dirY += 1;
    }
    if (this._keyState[KeyCode.KEY_S]) {
      dirY -= 1;
    }
    if (this._keyState[KeyCode.KEY_A]) {
      dirX -= 1;
    }
    if (this._keyState[KeyCode.KEY_D]) {
      dirX += 1;
    }

    if (dirX === 0 && dirY === 0) {
      this._rb.linearVelocity = Vec2.ZERO;
      this.playAnim("");
      return;
    }

    const len = Math.sqrt(dirX * dirX + dirY * dirY);
    dirX /= len;
    dirY /= len;

    // const move = new Vec3(dirX, dirY, 0).multiplyScalar(this._speed * dt);
    // this.node.translate(move);

    this._rb.linearVelocity = new Vec2(dirX * this._speed, dirY * this._speed);

    this.playMoveAnim(dirX, dirY);
  }

  // 上右下左 87 68 83 65
  onKeyDown(e: EventKeyboard) {
    if (!this._movable) return;
    this._keyState[e.keyCode] = true;
  }

  onKeyUp(e: EventKeyboard) {
    if (!this._movable) return;
    this._keyState[e.keyCode] = false;
  }
}
