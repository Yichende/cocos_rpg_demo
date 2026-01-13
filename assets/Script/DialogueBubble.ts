/**
 * 这里只操作：
 * UI 展示
 * 头像加载
 * 打字机效果
 * 对话切换
 */
import {
    _decorator,
    Component,
    Node,
    Label,
    Sprite,
    SpriteFrame,
    resources,
  } from "cc";
  
  import { SpeakerType } from "./Type/SpeakerType";
  
  const { ccclass, property } = _decorator;

  
  @ccclass("DialogueBubble")
  export class DialogueBubble extends Component {
    /* ---------- 节点引用 ---------- */
  
    @property(Sprite)
    avatarSprite: Sprite = null!;
  
    @property(Label)
    nameLabel: Label = null!;
  
    @property(Label)
    textLabel: Label = null!;

    private static _avatarCache: Map<string, SpriteFrame> = new Map();
  
    /* ---------- 打字机相关 ---------- */
  
    private _fullText: string = "";
    private _charIndex = 0;
    private _typingSpeed = 0.04; // 每个字符秒数
    private _isTyping = false;
  
    /* ---------- 对外接口 ---------- */

    public get isTyping(): boolean {
      return this._isTyping;
    }
    
  
    /**
     * 设置并播放一条对话
     */
    public showDialogue(
      speaker: SpeakerType,
      speakerName: string,
      content: string
    ) {
      this._setSpeaker(speaker, speakerName);
      this._startTyping(content);
    }
  
    /**
     * 立即完成当前打字
     */
    public completeTyping() {
      if (!this._isTyping) return;
  
      this.unschedule(this._typeNextChar);
      this.textLabel.string = this._fullText;
      this._isTyping = false;
    }
  
    /**
     * 清空对话框
     */
    public clear() {
      this.textLabel.string = "";
      this.nameLabel.string = "";
      this.avatarSprite.spriteFrame = null;
    }
  
    /* ---------- 内部逻辑 ---------- */
  
    private _setSpeaker(speaker: SpeakerType, name: string) {
      this.nameLabel.string = name;
      this._loadAvatar(speaker);
    }
  
    private _loadAvatar(speaker: SpeakerType) {
      const key = speaker;
      const path = `avatar/${speaker}/spriteFrame`;

      // 若命中缓存则直接使用
      if (DialogueBubble._avatarCache.has(key)) {
        this.avatarSprite.spriteFrame = DialogueBubble._avatarCache.get(key)!;
        return;
      }
  
      // 未命中则加载
      resources.load(path, SpriteFrame, (err, spriteFrame) => {
        if (err || !spriteFrame) {
          console.warn(`头像加载失败: ${path}`, err);
          return;
        }

        DialogueBubble._avatarCache.set(key, spriteFrame);
        this.avatarSprite.spriteFrame = spriteFrame;
      });
    }
  
    private _startTyping(text: string) {
      this.unschedule(this._typeNextChar);
  
      this._fullText = text;
      this._charIndex = 0;
      this.textLabel.string = "";
      this._isTyping = true;
  
      this.schedule(this._typeNextChar, this._typingSpeed);
    }
  
    private _typeNextChar = () => {
      if (this._charIndex >= this._fullText.length) {
        this._isTyping = false;
        this.unschedule(this._typeNextChar);
        return;
      }
  
      this.textLabel.string += this._fullText[this._charIndex];
      this._charIndex++;
    };
  }
  