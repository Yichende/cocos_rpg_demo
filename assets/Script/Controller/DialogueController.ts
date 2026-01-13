import {
  _decorator,
  Component,
  input,
  Input,
  EventMouse,
  EventKeyboard,
  KeyCode,
  find,
} from "cc";

import { DialogueBubble } from "../DialogueBubble";
import { DialogueLine, DIALOGUE } from "../Data/DialogData";
import { RoleController } from "./RoleController";

const { ccclass, property } = _decorator;

@ccclass("DialogueController")
export class DialogueController extends Component {
  @property(DialogueBubble)
  dialogueBubble: DialogueBubble = null!;

  private _dialogues: DialogueLine[] = [];
  private _index = 0;
  private _isPlaying = false;

  private _roleController: RoleController | null = null;

  /* ---------- 生命周期 ---------- */

  protected onLoad(): void {
    const roleNode = find("Canvas/World/role");
    if (!roleNode) {
      console.error("DialogueController: 未找到 World/role 节点");
      return;
    }

    this._roleController = roleNode.getComponent(RoleController);
    if (!this._roleController) {
      console.error("DialogueController: role 节点上没有 RoleController");
    }
  }

  onEnable() {
    input.on(Input.EventType.MOUSE_DOWN, this._onMouseDown, this);
    input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
  }

  onDisable() {
    input.off(Input.EventType.MOUSE_DOWN, this._onMouseDown, this);
    input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
  }

  start() {
    // 测试：直接播放测试对话
    this.startDialogue(DIALOGUE);
  }

  /* ---------- 对外接口 ---------- */

  public get isPlaying(): boolean {
    return this._isPlaying;
  }

  /**
   * 启动一段对话
   */
  public startDialogue(dialogues: DialogueLine[]) {
    if (!dialogues || dialogues.length === 0) return;

    console.log("对话启用");

    this._dialogues = dialogues;
    this._index = 0;
    this._isPlaying = true;

    // 确保对话框可见
    this.dialogueBubble.node.active = true;

    // 禁止玩家移动
    this._roleController?.setMovable(false);

    this._playCurrent();
  }

  /* ---------- 输入处理 ---------- */

  private _onMouseDown(event: EventMouse) {
    // 仅响应左键
    if (event.getButton() !== EventMouse.BUTTON_LEFT) return;
    this._onAdvance();
  }

  private _onKeyDown(event: EventKeyboard) {
    if (event.keyCode === KeyCode.SPACE) {
      this._onAdvance();
    }
  }

  /**
   * 推进对话（点击 / 空格）
   */
  private _onAdvance() {
    if (!this._isPlaying) return;

    // 如果正在打字，优先完成当前句
    if (this.dialogueBubble.isTyping) {
      this.dialogueBubble.completeTyping();
      return;
    }

    // 否则播放下一句
    this._index++;
    this._playCurrent();
  }

  /* ---------- 播放逻辑 ---------- */

  private _playCurrent() {
    // 对话结束
    if (this._index >= this._dialogues.length) {
      this._endDialogue();
      return;
    }

    const line = this._dialogues[this._index];
    this.dialogueBubble.showDialogue(line.speaker, line.name, line.content);
  }

  private _endDialogue() {
    console.log("对话终止");
    this._isPlaying = false;
    this.dialogueBubble.node.active = false;
    this.dialogueBubble.clear();

    this._roleController?.setMovable(true);

    // 这里可扩展：
    // - 恢复玩家控制
    // - 触发任务
    // - 派发事件
    // console.log("Dialogue finished");
  }
}
