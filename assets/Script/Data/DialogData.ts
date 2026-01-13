import { SpeakerType } from "../Type/SpeakerType";

/**
 * 单句对话数据结构
 */
export interface DialogueLine {
  speaker: SpeakerType; // 说话人
  name: string;         // 显示名称
  content: string;      // 对话文本
}

/**
 * 测试用对话数据
 * 后续可以替换为多段、分组、JSON 加载等
 */
export const DIALOGUE: DialogueLine[] = [
  {
    speaker: SpeakerType.HERO,
    name: "勇者",
    content: "这里就是传说中的遗迹吗？空气中弥漫着一股奇怪的气息。",
  },
  {
    speaker: SpeakerType.SKELETON,
    name: "骷髅士兵",
    content: "……生者？你不该踏入这里。",
  },
  {
    speaker: SpeakerType.HERO,
    name: "勇者",
    content: "看来想要通过，必须先击败你了。",
  },
];
